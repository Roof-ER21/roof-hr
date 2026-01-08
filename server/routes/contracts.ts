import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { storage } from '../storage';
import { insertContractTemplateSchema, insertEmployeeContractSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import {
  notifyManagersAndHROfSignedContract,
  notifyRecipientOfNewContract,
  notifyContractRejected,
  notifyContractSentInternal,
  notifyRecipientOfRescindedContract
} from '../services/contract-notification';
import { contractPdfService } from '../services/contractPdfService';
import { requireAuth, requireManager } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed') as any);
    }
  },
});

// Helper function to extract template variables and validate they have values
function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    variables.push(match[1].trim());
  }
  return Array.from(new Set(variables)); // Return unique variables
}

function validateTemplateVariables(
  content: string,
  providedValues: Record<string, string>
): { isValid: boolean; missingVariables: string[] } {
  const variables = extractTemplateVariables(content);
  const missingVariables = variables.filter(v => {
    // Check if variable is provided and not empty
    return !providedValues[v] && providedValues[v] !== '';
  });

  return {
    isValid: missingVariables.length === 0,
    missingVariables
  };
}

// Standard template variables that are auto-filled
const AUTO_FILLED_VARIABLES = [
  'name', 'employeeName', 'contractorName', 'firstName', 'lastName',
  'position', 'department', 'email', 'date', 'startDate', 'effectiveDate'
];

const MANAGER_LIKE_ROLES = ['MANAGER', 'TERRITORY_MANAGER', 'TERRITORY_SALES_MANAGER'] as const;
const isManagerRole = (role?: string | null) =>
  !!role && (MANAGER_LIKE_ROLES as readonly string[]).includes(role);

function buildBaseFieldValues(input: {
  recipientName: string;
  recipientEmail: string;
  recipientPosition?: string;
  recipientDepartment?: string;
}) {
  const [recipientFirstName, ...recipientLastNameParts] = input.recipientName.split(' ');
  const recipientLastName = recipientLastNameParts.join(' ');

  return {
    contractorName: input.recipientName,
    name: input.recipientName,
    employeeName: input.recipientName,
    firstName: recipientFirstName || input.recipientName,
    lastName: recipientLastName || input.recipientName,
    position: input.recipientPosition || '',
    department: input.recipientDepartment || '',
    email: input.recipientEmail,
  };
}

function applyTemplateReplacements(
  templateContent: string,
  values: Record<string, string>
) {
  let content = templateContent;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
  }
  return content;
}

async function isRetailContract(templateId?: string | null) {
  if (!templateId) return false;
  const template = await storage.getContractTemplateById(templateId);
  if (!template) return false;
  const name = `${template.name || ''}`.toLowerCase();
  return template.type === 'RETAIL' || name.includes('retail');
}

// Contract Templates

// Get all contract templates
router.get('/api/contract-templates', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    // For now, bypass auth to verify templates are working
    const templates = await storage.getAllContractTemplates();
    console.log(`Returning ${templates.length} contract templates`);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching contract templates:', error);
    res.status(500).json({ error: 'Failed to fetch contract templates' });
  }
});

// Get contract template by ID
router.get('/api/contract-templates/:id', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const template = await storage.getContractTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Contract template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching contract template:', error);
    res.status(500).json({ error: 'Failed to fetch contract template' });
  }
});

// Get contract templates by territory
router.get('/api/contract-templates/territory/:territory', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const templates = await storage.getContractTemplatesByTerritory(req.params.territory);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching territory contract templates:', error);
    res.status(500).json({ error: 'Failed to fetch contract templates' });
  }
});

// Create new contract template
router.post('/api/contract-templates', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const parsedData = insertContractTemplateSchema.parse({
      ...req.body,
      createdBy: user.id
    });

    const data = {
      ...parsedData,
      id: uuidv4(),
      type: parsedData.type as 'EMPLOYMENT' | 'NDA' | 'CONTRACTOR' | 'OTHER' | 'RETAIL'
    };

    const template = await storage.createContractTemplate(data);
    res.json(template);
  } catch (error: any) {
    console.error('Error creating contract template:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create contract template' });
  }
});

// Update contract template
router.patch('/api/contract-templates/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const template = await storage.updateContractTemplate(req.params.id, req.body);
    res.json(template);
  } catch (error) {
    console.error('Error updating contract template:', error);
    res.status(500).json({ error: 'Failed to update contract template' });
  }
});

// Delete contract template
router.delete('/api/contract-templates/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await storage.deleteContractTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contract template:', error);
    res.status(500).json({ error: 'Failed to delete contract template' });
  }
});

// Get template variables - for UI to know what fields to show
router.get('/api/contract-templates/:id/variables', requireAuth, requireManager, async (req: any, res) => {
  try {
    const template = await storage.getContractTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const variables = extractTemplateVariables(template.content);

    // Categorize variables
    const autoFilled = variables.filter(v => AUTO_FILLED_VARIABLES.includes(v));
    const userProvided = variables.filter(v => !AUTO_FILLED_VARIABLES.includes(v));

    res.json({
      templateId: template.id,
      templateName: template.name,
      allVariables: variables,
      autoFilled,
      userProvided,
      // Template's own variable list if defined
      declaredVariables: template.variables || []
    });
  } catch (error) {
    console.error('Error extracting template variables:', error);
    res.status(500).json({ error: 'Failed to extract template variables' });
  }
});

// Validate template variables before generating contract
router.post('/api/contract-templates/:id/validate', requireAuth, requireManager, async (req: any, res) => {
  try {
    const template = await storage.getContractTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { fieldValues, recipientType, employeeId, candidateId } = req.body;

    // Build the auto-filled values based on recipient
    const autoValues: Record<string, string> = {};

    if (recipientType === 'EMPLOYEE' && employeeId) {
      const employee = await storage.getUserById(employeeId);
      if (employee) {
        autoValues.name = `${employee.firstName} ${employee.lastName}`;
        autoValues.employeeName = autoValues.name;
        autoValues.firstName = employee.firstName;
        autoValues.lastName = employee.lastName;
        autoValues.position = employee.position || '';
        autoValues.department = employee.department || '';
        autoValues.email = employee.email;
        autoValues.date = new Date().toLocaleDateString();
        autoValues.startDate = new Date().toLocaleDateString();
      }
    } else if (recipientType === 'CANDIDATE' && candidateId) {
      const candidate = await storage.getCandidateById(candidateId);
      if (candidate) {
        autoValues.name = `${candidate.firstName} ${candidate.lastName}`;
        autoValues.employeeName = autoValues.name;
        autoValues.firstName = candidate.firstName;
        autoValues.lastName = candidate.lastName;
        autoValues.position = candidate.position || '';
        autoValues.department = 'New Hire';
        autoValues.email = candidate.email;
        autoValues.date = new Date().toLocaleDateString();
        autoValues.startDate = new Date().toLocaleDateString();
      }
    }

    // Combine auto-filled and user-provided values
    const allValues = { ...autoValues, ...fieldValues };

    // Validate
    const validation = validateTemplateVariables(template.content, allValues);

    res.json({
      isValid: validation.isValid,
      missingVariables: validation.missingVariables,
      providedVariables: Object.keys(allValues),
      allVariables: extractTemplateVariables(template.content)
    });
  } catch (error) {
    console.error('Error validating template variables:', error);
    res.status(500).json({ error: 'Failed to validate template variables' });
  }
});

// Upload master contract template PDF (Managers, Admins, HR only)
router.post('/api/contract-templates/upload',
  requireAuth,
  requireManager,
  upload.single('file'),
  async (req: any, res) => {
    try {
      const currentUser = req.user!;
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { name, type, territory, variables } = req.body;

      // Validate required fields
      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.pdf`;

      // Upload the PDF file
      await contractPdfService.uploadTemplate(req.file.buffer, fileName);

      // Parse variables if provided as string
      let variablesList: string[] = [];
      if (variables) {
        try {
          variablesList = JSON.parse(variables);
        } catch {
          variablesList = variables.split(',').map((v: string) => v.trim());
        }
      }

      // Create template record in database
      const template = await storage.createContractTemplate({
        id: uuidv4(),
        name,
        type: type as 'CONTRACTOR' | 'OTHER' | 'EMPLOYMENT' | 'NDA' | 'RETAIL',
        territory: territory || null,
        content: `PDF Template: ${name}`,
        fileUrl: `/attached_assets/contract_templates/${fileName}`,
        fileName,
        variables: variablesList,
        isActive: true,
        createdBy: currentUser.id,
      });

      console.log(`PDF template uploaded: ${name} by user ${currentUser.id}`);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error uploading PDF template:', error);
      res.status(500).json({ error: 'Failed to upload PDF template' });
    }
  }
);

// Generate contract from PDF template
router.post('/api/contracts/generate-from-template',
  requireAuth,
  async (req: any, res) => {
    try {
      const currentUser = req.user!;
      const { templateId, recipientType, employeeId, candidateId, fieldValues } = req.body;

      // Get the template
      const template = await storage.getContractTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Get recipient details
      let recipientName = '';
      let recipientEmail = '';

      if (recipientType === 'EMPLOYEE' && employeeId) {
        const employee = await storage.getUserById(employeeId);
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' });
        }
        recipientName = `${employee.firstName} ${employee.lastName}`;
        recipientEmail = employee.email;
      } else if (recipientType === 'CANDIDATE' && candidateId) {
        const candidate = await storage.getCandidateById(candidateId);
        if (!candidate) {
          return res.status(404).json({ error: 'Candidate not found' });
        }
        recipientName = `${candidate.firstName} ${candidate.lastName}`;
        recipientEmail = candidate.email;
      } else {
        return res.status(400).json({ error: 'Invalid recipient' });
      }

      const today = new Date().toLocaleDateString();
      const [recipientFirstName, ...recipientLastNameParts] = recipientName.split(' ');
      const recipientLastName = recipientLastNameParts.join(' ');

      const autoValues: Record<string, string> = {
        contractorName: recipientName,
        name: recipientName,
        employeeName: recipientName,
        firstName: recipientFirstName || recipientName,
        lastName: recipientLastName || recipientName,
        position: '',
        department: '',
        email: recipientEmail,
        date: today,
        startDate: today,
        effectiveDate: today,
        companySignatureDate: today,
      };

      const mergedFieldValues = { ...autoValues, ...(fieldValues || {}) };

      // If template has a PDF file, generate from it
      let generatedFileUrl = null;
      let generatedFileName = null;
      if (template.fileName && await contractPdfService.templateExists(template.fileName)) {
        // Generate unique output filename
        const outputFileName = `contract_${recipientName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;

        // Fill in the PDF fields
        const filledPdfPath = await contractPdfService.generateContract(
          template.fileName,
          {
            ...mergedFieldValues,
            contractorName: mergedFieldValues.contractorName || recipientName,
          },
          outputFileName
        );

        generatedFileUrl = `/attached_assets/contract_templates/${outputFileName}`;
        generatedFileName = outputFileName;
      }

      // Create the employee contract record
      const contract = await storage.createEmployeeContract({
        id: uuidv4(),
        employeeId: employeeId || null,
        candidateId: candidateId || null,
        templateId: templateId,
        recipientName,
        recipientEmail,
        title: `${template.name} - ${recipientName}`,
        content: template.content,
        fileUrl: generatedFileUrl,
        fileName: generatedFileName,
        status: 'DRAFT',
        createdBy: currentUser.id,
      });

      console.log(`Contract generated from template ${template.name} for ${recipientName}`);
      res.status(201).json(contract);
    } catch (error) {
      console.error('Error generating contract from template:', error);
      res.status(500).json({ error: 'Failed to generate contract from template' });
    }
  }
);

// Employee Contracts

// Get all contracts (generic endpoint for compatibility)
router.get('/api/contracts', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const allContracts = await storage.getAllEmployeeContracts();

    // Admin roles - see all contracts
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    if (isAdmin) {
      res.json(allContracts || []);
      return;
    }

    // Manager role - see own contracts + contracts they created + direct reports' contracts
    if (isManagerRole(user.role)) {
      // Get direct reports (users where this manager is their primaryManagerId)
      const allUsers = await storage.getAllUsers();
      const directReportIds = allUsers
        .filter(u => u.primaryManagerId === user.id)
        .map(u => u.id);

      const filteredContracts = allContracts.filter(contract => {
        // Their own contracts
        if (contract.employeeId === user.id) return true;
        // Contracts they created
        if (contract.createdBy === user.id) return true;
        // Direct reports' contracts
        if (contract.employeeId && directReportIds.includes(contract.employeeId)) return true;
        return false;
      });

      res.json(filteredContracts || []);
      return;
    }

    // Regular employees - only see their own contracts
    const ownContracts = allContracts.filter(contract => contract.employeeId === user.id);
    res.json(ownContracts || []);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Get all employee contracts
router.get('/api/employee-contracts', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const allContracts = await storage.getAllEmployeeContracts();

    // Admin roles - see all contracts
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    if (isAdmin) {
      res.json(allContracts);
      return;
    }

    // Manager role - see own contracts + contracts they created + direct reports' contracts
    if (isManagerRole(user.role)) {
      const allUsers = await storage.getAllUsers();
      const directReportIds = allUsers
        .filter(u => u.primaryManagerId === user.id)
        .map(u => u.id);

      const filteredContracts = allContracts.filter(contract => {
        if (contract.employeeId === user.id) return true;
        if (contract.createdBy === user.id) return true;
        if (contract.employeeId && directReportIds.includes(contract.employeeId)) return true;
        return false;
      });

      res.json(filteredContracts);
      return;
    }

    // Fallback - shouldn't reach here with requireManager but just in case
    res.json([]);
  } catch (error: any) {
    console.error('Error fetching employee contracts:', error);
    console.error('Error stack:', error?.stack);
    res.status(500).json({
      error: 'Failed to fetch employee contracts',
      details: error?.message || 'Unknown error'
    });
  }
});

// Get employee contracts for specific employee
router.get('/api/employee-contracts/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const requestedEmployeeId = req.params.employeeId;

    // Admin roles can view any
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    // User viewing their own contracts
    const isOwnContracts = user.id === requestedEmployeeId;

    // Manager viewing direct report's contracts
    let isDirectReport = false;
    if (isManagerRole(user.role)) {
      const targetEmployee = await storage.getUserById(requestedEmployeeId);
      if (targetEmployee && targetEmployee.primaryManagerId === user.id) {
        isDirectReport = true;
      }
    }

    if (!isAdmin && !isOwnContracts && !isDirectReport) {
      return res.status(403).json({ error: 'Can only view your own or direct reports\' contracts' });
    }

    const contracts = await storage.getEmployeeContractsByEmployeeId(requestedEmployeeId);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching employee contracts:', error);
    res.status(500).json({ error: 'Failed to fetch employee contracts' });
  }
});

// Get employee contract by ID
router.get('/api/employee-contracts/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Admin roles can view any contract
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    // User viewing their own contract
    const isOwnContract = contract.employeeId === user.id;

    // User created this contract
    const isCreator = contract.createdBy === user.id;

    // Manager viewing direct report's contract
    let isDirectReportContract = false;
    if (contract.employeeId && isManagerRole(user.role)) {
      const targetEmployee = await storage.getUserById(contract.employeeId);
      if (targetEmployee && targetEmployee.primaryManagerId === user.id) {
        isDirectReportContract = true;
      }
    }

    if (!isAdmin && !isOwnContract && !isCreator && !isDirectReportContract) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Error fetching employee contract:', error);
    res.status(500).json({ error: 'Failed to fetch employee contract' });
  }
});

// Create new employee contract
router.post('/api/employee-contracts', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const { fieldValues = {}, ...contractPayload } = req.body;
    // Parse the request based on recipient type
    let recipientName = '';
    let recipientEmail = '';
    let recipientPosition = '';
    let recipientDepartment = '';

    if (req.body.recipientType === 'CANDIDATE') {
      // Get candidate information
      const candidate = await storage.getCandidateById(req.body.candidateId);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      recipientName = `${candidate.firstName} ${candidate.lastName}`;
      recipientEmail = candidate.email;
      recipientPosition = candidate.position;
      recipientDepartment = 'New Hire'; // Default for candidates
    } else {
      // Get employee information
      const employee = await storage.getUserById(req.body.employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      recipientName = `${employee.firstName} ${employee.lastName}`;
      recipientEmail = employee.email;
      recipientPosition = employee.position;
      recipientDepartment = employee.department;
    }

    let parsedData = insertEmployeeContractSchema.parse({
      ...contractPayload,
      recipientName,
      recipientEmail,
      createdBy: user.id,
      status: 'DRAFT' as const
    });

    // If using a template, fetch it and populate the content
    if (parsedData.templateId) {
      const template = await storage.getContractTemplateById(parsedData.templateId);
      if (template) {
        const today = new Date().toLocaleDateString();
        const baseValues = buildBaseFieldValues({
          recipientName,
          recipientEmail,
          recipientPosition,
          recipientDepartment
        });

        const autoValues: Record<string, string> = {
          ...baseValues,
          date: today,
          startDate: today,
          effectiveDate: today,
          companySignatureDate: today,
        };

        const mergedFieldValues = { ...autoValues, ...(fieldValues || {}) };
        // Replace variables in template content
        let content = template.content;

        // Replace common variables
        content = applyTemplateReplacements(content, mergedFieldValues);

        parsedData = { ...parsedData, content, fieldValues: mergedFieldValues };

        if (template.fileName && await contractPdfService.templateExists(template.fileName)) {
          const outputFileName = `contract_${recipientName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
          await contractPdfService.generateContract(template.fileName, mergedFieldValues, outputFileName);
          parsedData = {
            ...parsedData,
            fileUrl: `/attached_assets/contract_templates/${outputFileName}`,
            fileName: outputFileName
          };
        }
      }
    }

    const contractData: any = {
      ...parsedData,
      id: uuidv4(),
      status: 'DRAFT' as 'DRAFT' | 'SENT' | 'VIEWED' | 'SIGNED' | 'REJECTED' | 'RESCINDED'
    };

    if (!contractData.fieldValues && fieldValues && Object.keys(fieldValues).length > 0) {
      contractData.fieldValues = fieldValues;
    }

    // Type assertion for recipientType if present
    if (contractData.recipientType) {
      contractData.recipientType = contractData.recipientType as 'EMPLOYEE' | 'CANDIDATE';
    }

    const contract = await storage.createEmployeeContract(contractData);
    res.json(contract);
  } catch (error: any) {
    console.error('Error creating employee contract:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid contract data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create employee contract' });
  }
});

// Update employee contract
router.patch('/api/employee-contracts/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Admin roles can update any contract
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    // Check permissions - employee can update some fields, authorized managers can update all
    const isEmployee = contract.employeeId === user.id;
    const isCreator = contract.createdBy === user.id;

    // Manager can only update if they're the creator or it's their direct report's contract
    let canManagerUpdate = false;
    if (!isAdmin && isManagerRole(user.role)) {
      if (isCreator) {
        canManagerUpdate = true;
      } else if (contract.employeeId) {
        const targetEmployee = await storage.getUserById(contract.employeeId);
        if (targetEmployee && targetEmployee.primaryManagerId === user.id) {
          canManagerUpdate = true;
        }
      }
    }

    const isManager = isAdmin || canManagerUpdate;

    if (!isEmployee && !isManager) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Employees can only sign/reject, not edit content
    if (isEmployee && !isManager) {
      const allowedFields = ['status', 'signature', 'signatureIp', 'signedDate', 'rejectionReason'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      // If signing, update dates and send notifications
      if (updateData.status === 'SIGNED' && updateData.signature) {
        updateData.signedDate = new Date();
        updateData.signatureIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
        
        // Send notification to managers and HR after successful signing
        const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);
        
        await notifyManagersAndHROfSignedContract({
          contractId: req.params.id,
          employeeName: contract.recipientName,
          contractTitle: contract.title,
          signedDate: updateData.signedDate,
          signature: updateData.signature,
          fileUrl: updatedContract.fileUrl || contract.fileUrl || undefined
        }, user.email); // Pass user email for Gmail impersonation
        
        res.json(updatedContract);
        return;
      }
      
      if (updateData.status === 'VIEWED' && contract.status === 'SENT') {
        updateData.viewedDate = new Date();
      }
      
      const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);
      res.json(updatedContract);
    } else {
      // Managers can update everything
      const updateData: any = { ...req.body };
      const incomingFieldValues = updateData.fieldValues;
      const regeneratePdf = Boolean(updateData.regeneratePdf);
      delete updateData.regeneratePdf;

      if (incomingFieldValues) {
        updateData.fieldValues = {
          ...(contract.fieldValues || {}),
          ...incomingFieldValues
        };
      }

      const shouldRegenerate = regeneratePdf || Boolean(incomingFieldValues);
      if (shouldRegenerate && contract.templateId) {
        const template = await storage.getContractTemplateById(contract.templateId);
        if (template) {
          let recipientPosition = '';
          let recipientDepartment = '';

          if (contract.employeeId) {
            const employee = await storage.getUserById(contract.employeeId);
            recipientPosition = employee?.position || '';
            recipientDepartment = employee?.department || '';
          } else if (contract.candidateId) {
            const candidate = await storage.getCandidateById(contract.candidateId);
            recipientPosition = candidate?.position || '';
            recipientDepartment = 'New Hire';
          }

          const baseValues = buildBaseFieldValues({
            recipientName: contract.recipientName,
            recipientEmail: contract.recipientEmail,
            recipientPosition,
            recipientDepartment
          });

          const mergedValues = {
            ...baseValues,
            ...(contract.fieldValues || {}),
            ...(incomingFieldValues || {})
          };

          updateData.fieldValues = mergedValues;
          updateData.content = applyTemplateReplacements(template.content, mergedValues);

          if (template.fileName && await contractPdfService.templateExists(template.fileName)) {
            const outputFileName = `contract_${contract.recipientName.toLowerCase().replace(/\\s+/g, '_')}_${Date.now()}.pdf`;
            await contractPdfService.generateContract(template.fileName, mergedValues, outputFileName);
            updateData.fileUrl = `/attached_assets/contract_templates/${outputFileName}`;
            updateData.fileName = outputFileName;
          }
        }
      }
      
      // Update sent date if status changes to SENT and notify recipient
      if (updateData.status === 'SENT' && contract.status === 'DRAFT') {
        updateData.sentDate = new Date();
        updateData.sentBy = user.id;

        // Generate access token for public link (no login required)
        const accessToken = generateAccessToken();
        const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        updateData.accessToken = accessToken;
        updateData.tokenExpiry = tokenExpiry;

        const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);

        // Send notification to the recipient via Gmail (from manager's email)
        // Pass accessToken so email uses public link
        await notifyRecipientOfNewContract(
          contract.recipientEmail,
          contract.recipientName,
          contract.title,
          req.params.id,
          user.email, // Pass sender's email for Gmail impersonation
          updatedContract.fileUrl || contract.fileUrl || undefined,
          accessToken // Pass token for public link
        );

        await notifyContractSentInternal(
          {
            id: updatedContract.id,
            recipientName: updatedContract.recipientName,
            recipientEmail: updatedContract.recipientEmail,
            title: updatedContract.title,
            fileUrl: updatedContract.fileUrl || undefined
          },
          user.email
        );
        
        res.json(updatedContract);
        return;
      }
      
      const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);
      res.json(updatedContract);
    }
  } catch (error) {
    console.error('Error updating employee contract:', error);
    res.status(500).json({ error: 'Failed to update employee contract' });
  }
});

// Delete employee contract
router.delete('/api/employee-contracts/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Admin roles can delete any contract
    const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER'];
    const isAdmin = user.email === 'ahmed.mahmoud@theroofdocs.com' || adminRoles.includes(user.role);

    if (!isAdmin) {
      // Manager can only delete if they created it or it's their direct report's contract
      const isCreator = contract.createdBy === user.id;
      let isDirectReportContract = false;

      if (contract.employeeId && isManagerRole(user.role)) {
        const targetEmployee = await storage.getUserById(contract.employeeId);
        if (targetEmployee && targetEmployee.primaryManagerId === user.id) {
          isDirectReportContract = true;
        }
      }

      if (!isCreator && !isDirectReportContract) {
        return res.status(403).json({ error: 'Can only delete contracts you created or for your direct reports' });
      }
    }

    await storage.deleteEmployeeContract(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee contract:', error);
    res.status(500).json({ error: 'Failed to delete employee contract' });
  }
});

// Sign employee contract
router.post('/api/employee-contracts/:id/sign', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { signature, signatureAddress } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Signature required' });
    }
    if (!signatureAddress) {
      return res.status(400).json({ error: 'Mailing address required' });
    }

    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if user is the employee
    if (contract.employeeId !== user.id) {
      return res.status(403).json({ error: 'Only the employee can sign their contract' });
    }

    // Check if contract is in a signable state
    if (!['SENT', 'VIEWED'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contract is not ready for signature' });
    }

    // Capture IP address from request
    const signatureIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const signedDate = new Date();

    let signedFileUrl: string | null = null;
    let signedFileName: string | null = null;
    const sourceFileName = contract.fileName || (contract.fileUrl ? path.basename(contract.fileUrl) : null);

    if (sourceFileName && await contractPdfService.templateExists(sourceFileName)) {
      try {
        let layoutFileName: string | undefined;
        if (contract.templateId) {
          const template = await storage.getContractTemplateById(contract.templateId);
          layoutFileName = template?.fileName || undefined;
        }
        signedFileName = `signed_contract_${contract.id}_${Date.now()}.pdf`;
        await contractPdfService.applySignatureToPdf(
          sourceFileName,
          signature,
          signedDate,
          signedFileName,
          layoutFileName,
          signatureAddress
        );
        signedFileUrl = `/attached_assets/contract_templates/${signedFileName}`;
      } catch (error) {
        console.error('[Contracts] Failed to apply signature to PDF:', error);
      }
    }

    const updatedContract = await storage.updateEmployeeContract(req.params.id, {
      status: 'SIGNED',
      signature,
      signatureAddress,
      signatureIp,
      signedDate,
      ...(signedFileUrl ? { fileUrl: signedFileUrl, fileName: signedFileName } : {})
    });

    // Send notification to managers and HR about signed contract
    const senderUserId = contract.sentBy || contract.createdBy;
    const senderUser = senderUserId ? await storage.getUserById(senderUserId) : null;
    const senderEmail = senderUser?.email || undefined;
    const retailFlag = await isRetailContract(contract.templateId);
    await notifyManagersAndHROfSignedContract({
      contractId: req.params.id,
      employeeName: contract.recipientName,
      contractTitle: contract.title,
      signedDate,
      signature,
      fileUrl: updatedContract.fileUrl || contract.fileUrl || undefined
    }, senderEmail, retailFlag);

    console.log(`Contract ${req.params.id} signed by ${user.email} from IP ${signatureIp}`);

    res.json(updatedContract);
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Reject employee contract
router.post('/api/employee-contracts/:id/reject', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }

    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if user is the employee
    if (contract.employeeId !== user.id) {
      return res.status(403).json({ error: 'Only the employee can reject their contract' });
    }
    
    // Check if contract is in a rejectable state
    if (!['SENT', 'VIEWED'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contract cannot be rejected in its current state' });
    }
    
    const updatedContract = await storage.updateEmployeeContract(req.params.id, {
      status: 'REJECTED',
      rejectionReason: reason
    });

    const senderUserId = contract.sentBy || contract.createdBy;
    const senderUser = senderUserId ? await storage.getUserById(senderUserId) : null;
    const senderEmail = senderUser?.email || undefined;
    const retailFlag = await isRetailContract(contract.templateId);
    await notifyContractRejected({
      id: updatedContract.id,
      recipientName: updatedContract.recipientName,
      recipientEmail: updatedContract.recipientEmail,
      title: updatedContract.title,
      fileUrl: updatedContract.fileUrl || undefined,
      rejectionReason: reason
    }, senderEmail, retailFlag);
    
    res.json(updatedContract);
  } catch (error) {
    console.error('Error rejecting contract:', error);
    res.status(500).json({ error: 'Failed to reject contract' });
  }
});

// Rescind contract (manager only)
router.post('/api/employee-contracts/:id/rescind', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const { reason } = req.body;

    const contract = await storage.getEmployeeContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (['SIGNED', 'REJECTED', 'RESCINDED'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contract cannot be rescinded in its current state' });
    }

    const updatedContract = await storage.updateEmployeeContract(req.params.id, {
      status: 'RESCINDED',
      rejectionReason: reason || 'Offer rescinded by management',
      updatedAt: new Date()
    });

    const senderEmail = user.email;
    const retailFlag = await isRetailContract(contract.templateId);
    await notifyContractRejected({
      id: updatedContract.id,
      recipientName: updatedContract.recipientName,
      recipientEmail: updatedContract.recipientEmail,
      title: updatedContract.title,
      fileUrl: updatedContract.fileUrl || undefined,
      rejectionReason: updatedContract.rejectionReason || undefined
    }, senderEmail, retailFlag);

    await notifyRecipientOfRescindedContract({
      id: updatedContract.id,
      recipientName: updatedContract.recipientName,
      recipientEmail: updatedContract.recipientEmail,
      title: updatedContract.title,
    }, senderEmail, updatedContract.rejectionReason || undefined);

    res.json(updatedContract);
  } catch (error) {
    console.error('Error rescinding contract:', error);
    res.status(500).json({ error: 'Failed to rescind contract' });
  }
});

// ============================================
// Public Routes (No Authentication Required)
// ============================================

// Helper function to generate access token
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Get contract by token (public form access - no login required)
router.get('/api/public/contract/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const contract = await storage.getEmployeeContractByToken(token);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found or invalid token' });
    }

    // Check token expiry
    if (contract.tokenExpiry && new Date(contract.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This contract link has expired. Please contact HR for a new link.' });
    }

    // Check if already signed
    if (contract.status === 'SIGNED') {
      return res.status(200).json({
        ...contract,
        alreadySigned: true,
        message: 'This contract has already been signed'
      });
    }

    // Check if rejected or rescinded
    if (contract.status === 'REJECTED' || contract.status === 'RESCINDED') {
      return res.status(400).json({
        error: `This contract has been ${contract.status.toLowerCase()}`
      });
    }

    // Mark as viewed if not already
    if (contract.status === 'SENT' && !contract.viewedDate) {
      await storage.updateEmployeeContract(contract.id, {
        status: 'VIEWED',
        viewedDate: new Date()
      });
    }

    // Return contract data for viewing (exclude sensitive internal fields)
    res.json({
      id: contract.id,
      recipientName: contract.recipientName,
      recipientEmail: contract.recipientEmail,
      title: contract.title,
      content: contract.content,
      fileUrl: contract.fileUrl,
      fileName: contract.fileName,
      status: contract.status,
      fieldValues: contract.fieldValues,
      createdAt: contract.createdAt
    });
  } catch (error: any) {
    console.error('Error fetching contract by token:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

// Sign contract (public form submission - no login required)
router.post('/api/public/contract/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signature, signatureAddress } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    const contract = await storage.getEmployeeContractByToken(token);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found or invalid token' });
    }

    // Check token expiry
    if (contract.tokenExpiry && new Date(contract.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This contract link has expired. Please contact HR for a new link.' });
    }

    // Check if already signed
    if (contract.status === 'SIGNED') {
      return res.status(400).json({ error: 'This contract has already been signed' });
    }

    // Check if rejected or rescinded
    if (contract.status === 'REJECTED' || contract.status === 'RESCINDED') {
      return res.status(400).json({
        error: `This contract has been ${contract.status.toLowerCase()} and cannot be signed`
      });
    }

    const signedDate = new Date();
    const signatureIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    // Apply signature to PDF if there's a file
    let updatedFileUrl = contract.fileUrl;
    if (contract.fileUrl && contract.fileName) {
      try {
        const signedFileName = `signed_${Date.now()}_${contract.fileName}`;
        const templateFileName = contract.fileName;

        await contractPdfService.applySignatureToPdf(
          templateFileName,
          signature,
          signedDate,
          signedFileName,
          templateFileName,
          signatureAddress || undefined
        );

        updatedFileUrl = `/attached_assets/contract_templates/${signedFileName}`;
      } catch (pdfError) {
        console.error('Error applying signature to PDF:', pdfError);
        // Continue without PDF update - signature is still captured
      }
    }

    // Update contract with signature
    const updatedContract = await storage.updateEmployeeContract(contract.id, {
      status: 'SIGNED',
      signature,
      signatureAddress: signatureAddress || null,
      signatureIp,
      signedDate,
      fileUrl: updatedFileUrl
    });

    // Send notification to managers and HR
    const retailFlag = await isRetailContract(contract.templateId);
    await notifyManagersAndHROfSignedContract({
      contractId: contract.id,
      employeeName: contract.recipientName,
      contractTitle: contract.title,
      signedDate,
      signature,
      fileUrl: updatedFileUrl || undefined
    }, contract.sentBy || undefined, retailFlag);

    res.json({
      success: true,
      message: 'Contract signed successfully',
      contract: {
        id: updatedContract.id,
        status: updatedContract.status,
        signedDate: updatedContract.signedDate
      }
    });
  } catch (error: any) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Download contract PDF (public access via token)
router.get('/api/public/contract/:token/download', async (req, res) => {
  try {
    const { token } = req.params;
    const contract = await storage.getEmployeeContractByToken(token);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found or invalid token' });
    }

    // Check token expiry
    if (contract.tokenExpiry && new Date(contract.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This contract link has expired' });
    }

    if (!contract.fileUrl || !contract.fileName) {
      return res.status(404).json({ error: 'No PDF file available for this contract' });
    }

    // Construct file path
    const filePath = path.join(process.cwd(), contract.fileUrl.replace(/^\//, ''));

    res.download(filePath, contract.fileName, (err) => {
      if (err) {
        console.error('Error downloading contract PDF:', err);
        res.status(500).json({ error: 'Failed to download contract' });
      }
    });
  } catch (error: any) {
    console.error('Error downloading contract:', error);
    res.status(500).json({ error: 'Failed to download contract' });
  }
});

// Admin endpoint to add retail templates
router.post('/api/admin/contracts/add-retail-templates', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = (req as any).user;
    if (!user || !['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const results: any[] = [];
    const existingTemplates = await storage.getAllContractTemplates();

    // Retail Marketing template
    const marketingExists = existingTemplates.some(t =>
      t.name === 'Retail Marketing Representative Agreement' ||
      t.fileName === 'retail_marketing_contractor_agreement.pdf'
    );

    if (!marketingExists) {
      const marketingTemplate = await storage.createContractTemplate({
        id: uuidv4(),
        name: 'Retail Marketing Representative Agreement',
        type: 'RETAIL',
        territory: null,
        content: 'Retail marketing contractor agreement',
        fileUrl: '/attached_assets/contract_templates/retail_marketing_contractor_agreement.pdf',
        fileName: 'retail_marketing_contractor_agreement.pdf',
        variables: ['contractorName', 'effectiveDate', 'signatureName', 'signatureDate'],
        isActive: true,
        createdBy: user.email || 'admin'
      });
      results.push({ created: 'Retail Marketing Representative Agreement' });
    } else {
      results.push({ skipped: 'Retail Marketing Representative Agreement (already exists)' });
    }

    // Retail Sales template
    const salesExists = existingTemplates.some(t =>
      t.name === 'Retail Sales Consultant Agreement' ||
      t.fileName === 'retail_sales_contractor_agreement.pdf'
    );

    if (!salesExists) {
      const salesTemplate = await storage.createContractTemplate({
        id: uuidv4(),
        name: 'Retail Sales Consultant Agreement',
        type: 'RETAIL',
        territory: null,
        content: 'Retail sales contractor agreement',
        fileUrl: '/attached_assets/contract_templates/retail_sales_contractor_agreement.pdf',
        fileName: 'retail_sales_contractor_agreement.pdf',
        variables: ['contractorName', 'effectiveDate', 'signatureName', 'signatureDate'],
        isActive: true,
        createdBy: user.email || 'admin'
      });
      results.push({ created: 'Retail Sales Consultant Agreement' });
    } else {
      results.push({ skipped: 'Retail Sales Consultant Agreement (already exists)' });
    }

    // Update existing territory templates with new PDF files
    const updateResults: any[] = [];

    // Update Richmond templates
    const richmondTemplates = existingTemplates.filter(t =>
      t.territory === 'Richmond' || t.name?.toLowerCase().includes('richmond')
    );
    for (const template of richmondTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/richmond_contractor_agreement.pdf',
        fileName: 'richmond_contractor_agreement.pdf'
      });
      updateResults.push({ updated: `${template.name} -> richmond PDF` });
    }

    // Update DMV templates
    const dmvTemplates = existingTemplates.filter(t =>
      t.territory === 'DMV' || t.name?.toLowerCase().includes('dmv')
    );
    for (const template of dmvTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/dmv_pa_contractor_agreement.pdf',
        fileName: 'dmv_pa_contractor_agreement.pdf'
      });
      updateResults.push({ updated: `${template.name} -> dmv_pa PDF` });
    }

    // Update PA templates
    const paTemplates = existingTemplates.filter(t =>
      t.territory === 'PA' || (t.name?.toLowerCase().includes('pa ') || t.name?.toLowerCase().includes('pennsylvania'))
    );
    for (const template of paTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/dmv_pa_contractor_agreement.pdf',
        fileName: 'dmv_pa_contractor_agreement.pdf'
      });
      updateResults.push({ updated: `${template.name} -> dmv_pa PDF` });
    }

    res.json({
      success: true,
      templates: results,
      updates: updateResults
    });
  } catch (error: any) {
    console.error('Error adding retail templates:', error);
    res.status(500).json({ error: 'Failed to add retail templates', details: error.message });
  }
});

export { generateAccessToken };
export default router;
