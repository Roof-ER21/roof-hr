import { google } from 'googleapis';
import { googleAuthService } from './google-auth';

class GoogleSheetsService {
  private sheets: any;

  async initialize() {
    try {
      await googleAuthService.initialize();
      const auth = googleAuthService.getAuthClient();
      this.sheets = google.sheets({ version: 'v4', auth });
      console.log('[Google Sheets] Service initialized with service account');
    } catch (error) {
      console.error('[Google Sheets] Failed to initialize:', error);
      throw error;
    }
  }

  async createSpreadsheet(title: string, sheetNames: string[] = ['Sheet1']) {
    try {
      const resource = {
        properties: {
          title
        },
        sheets: sheetNames.map(name => ({
          properties: {
            title: name
          }
        }))
      };

      const response = await this.sheets.spreadsheets.create({
        resource,
        fields: 'spreadsheetId,spreadsheetUrl'
      });

      console.log('[Google Sheets] Spreadsheet created:', response.data.spreadsheetId);
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error creating spreadsheet:', error);
      throw error;
    }
  }

  async readSpreadsheet(spreadsheetId: string, range: string) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values;
    } catch (error) {
      console.error('[Google Sheets] Error reading spreadsheet:', error);
      throw error;
    }
  }

  async writeToSpreadsheet(spreadsheetId: string, range: string, values: any[][]) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values
        }
      });

      console.log('[Google Sheets] Data written:', response.data.updatedCells, 'cells');
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error writing to spreadsheet:', error);
      throw error;
    }
  }

  async appendToSpreadsheet(spreadsheetId: string, range: string, values: any[][]) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values
        }
      });

      console.log('[Google Sheets] Data appended:', response.data.updates?.updatedCells, 'cells');
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error appending to spreadsheet:', error);
      throw error;
    }
  }

  async clearSpreadsheet(spreadsheetId: string, range: string) {
    try {
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range
      });

      console.log('[Google Sheets] Range cleared:', range);
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error clearing spreadsheet:', error);
      throw error;
    }
  }
  
  async updateSheet(spreadsheetId: string, range: string, values: any[][]) {
    try {
      // First check if sheet exists by trying to get its data
      const sheetName = range.split('!')[0];
      try {
        await this.getSheetData(spreadsheetId, `${sheetName}!A1`);
      } catch (error: any) {
        // If sheet doesn't exist, create it
        if (error?.response?.status === 400) {
          await this.addSheet(spreadsheetId, sheetName);
        }
      }
      
      // Clear existing data first (if any)
      try {
        await this.clearSpreadsheet(spreadsheetId, `${sheetName}!A:ZZ`);
      } catch (clearError) {
        // If clear fails, it's okay - sheet might be empty
        console.log('[Google Sheets] Sheet might be empty, proceeding with write');
      }
      
      // Write new data
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values
        }
      });

      console.log('[Google Sheets] Sheet updated:', response.data.updatedCells, 'cells');
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error updating sheet:', error);
      throw error;
    }
  }
  
  async addSheet(spreadsheetId: string, sheetName: string) {
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });
      console.log('[Google Sheets] Sheet added:', sheetName);
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error adding sheet:', error);
      throw error;
    }
  }
  
  async getSheetData(spreadsheetId: string, range: string) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values || [];
    } catch (error) {
      console.error('[Google Sheets] Error getting sheet data:', error);
      throw error;
    }
  }

  // Export tools inventory to Google Sheets
  async exportToolsInventory(tools: any[]) {
    try {
      // Create a new spreadsheet for tools inventory
      const spreadsheet = await this.createSpreadsheet('ROOF-ER Tools Inventory', ['Inventory', 'Assignments', 'History']);
      
      // Prepare headers and data
      const headers = [
        ['Tool ID', 'Name', 'Category', 'Serial Number', 'Model', 'Quantity', 'Available', 'Condition', 'Purchase Date', 'Price', 'Location', 'Status', 'Notes']
      ];

      const toolsData = tools.map(tool => [
        tool.id,
        tool.name,
        tool.category,
        tool.serialNumber,
        tool.model,
        tool.quantity,
        tool.availableQuantity,
        tool.condition,
        tool.purchaseDate ? new Date(tool.purchaseDate).toLocaleDateString() : '',
        tool.purchasePrice,
        tool.location,
        tool.isActive ? 'Active' : 'Inactive',
        tool.notes || ''
      ]);

      // Write headers and data
      await this.writeToSpreadsheet(
        spreadsheet.spreadsheetId!,
        'Inventory!A1',
        [...headers, ...toolsData]
      );

      // Format the spreadsheet
      await this.formatSpreadsheet(spreadsheet.spreadsheetId!, {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 13
              }
            }
          }
        ]
      });

      return spreadsheet;
    } catch (error) {
      console.error('[Google Sheets] Error exporting tools inventory:', error);
      throw error;
    }
  }

  // Import tools inventory from Google Sheets
  async importToolsInventory(spreadsheetId: string) {
    try {
      const data = await this.readSpreadsheet(spreadsheetId, 'Inventory!A2:M');
      
      if (!data || data.length === 0) {
        return [];
      }

      const tools = data.map((row: string[]) => ({
        id: row[0],
        name: row[1],
        category: row[2],
        serialNumber: row[3],
        model: row[4],
        quantity: parseInt(row[5]) || 0,
        availableQuantity: parseInt(row[6]) || 0,
        condition: row[7],
        purchaseDate: row[8] ? new Date(row[8]) : null,
        purchasePrice: parseFloat(row[9]) || 0,
        location: row[10],
        isActive: row[11] === 'Active',
        notes: row[12] || ''
      }));

      return tools;
    } catch (error) {
      console.error('[Google Sheets] Error importing tools inventory:', error);
      throw error;
    }
  }

  private async formatSpreadsheet(spreadsheetId: string, batchUpdateRequest: any) {
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: batchUpdateRequest
      });
      return response.data;
    } catch (error) {
      console.error('[Google Sheets] Error formatting spreadsheet:', error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();