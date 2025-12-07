import express from 'express';
import multer from 'multer';
import path from 'path';
import { storage } from '../storage';
import { insertContractTemplateSchema, insertEmployeeContractSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { 
  notifyManagersAndHROfSignedContract, 
  notifyRecipientOfNewContract 
} from '../services/contract-notification';
import { contractPdfService } from '../services/contractPdfService';

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

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

// Contract Templates

// Get all contract templates
router.get('/api/contract-templates', requireAuth, async (req: any, res) => {
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
router.get('/api/contract-templates/:id', requireAuth, requireManager, async (req, res) => {
  try {
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
router.get('/api/contract-templates/territory/:territory', requireAuth, requireManager, async (req, res) => {
  try {
    const templates = await storage.getContractTemplatesByTerritory(req.params.territory);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching territory contract templates:', error);
    res.status(500).json({ error: 'Failed to fetch contract templates' });
  }
});

// Create new contract template
router.post('/api/contract-templates', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = insertContractTemplateSchema.parse({
      ...req.body,
      id: uuidv4(),
      createdBy: user.id
    });

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
        type: type as 'CONTRACTOR' | 'OTHER' | 'EMPLOYMENT' | 'NDA',
        territory: territory || null,
        content: `PDF Template: ${name}`,
        fileUrl: `/contract-templates/${fileName}`,
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

      // If template has a PDF file, generate from it
      let generatedFileUrl = null;
      if (template.fileName && await contractPdfService.templateExists(template.fileName)) {
        // Generate unique output filename
        const outputFileName = `contract_${recipientName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;

        // Fill in the PDF fields
        const filledPdfPath = await contractPdfService.generateContract(
          template.fileName,
          {
            ...fieldValues,
            contractorName: fieldValues.contractorName || recipientName,
          },
          outputFileName
        );

        generatedFileUrl = `/contract-templates/${outputFileName}`;
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
    // If user is manager/admin, show all contracts. Otherwise show their own.
    let contracts;
    if (['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'HR_MANAGER'].includes(user.role)) {
      contracts = await storage.getAllEmployeeContracts();
    } else {
      contracts = await storage.getEmployeeContractsByEmployeeId(user.id);
    }
    res.json(contracts || []);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Get all employee contracts
router.get('/api/employee-contracts', requireAuth, requireManager, async (req, res) => {
  try {
    const contracts = await storage.getAllEmployeeContracts();
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching employee contracts:', error);
    res.status(500).json({ error: 'Failed to fetch employee contracts' });
  }
});

// Get employee contracts for specific employee
router.get('/api/employee-contracts/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    // Users can view their own contracts, managers can view any
    if (user.id !== req.params.employeeId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Can only view your own contracts' });
    }

    const contracts = await storage.getEmployeeContractsByEmployeeId(req.params.employeeId);
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

    // Check access permissions
    if (contract.employeeId !== user.id &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
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

    const data = insertEmployeeContractSchema.parse({
      ...req.body,
      id: uuidv4(),
      recipientName,
      recipientEmail,
      createdBy: user.id,
      status: 'DRAFT'
    });
    
    // If using a template, fetch it and populate the content
    if (data.templateId) {
      const template = await storage.getContractTemplateById(data.templateId);
      if (template) {
        // Replace variables in template content
        let content = template.content;
        
        // Replace common variables
        const replacements: { [key: string]: string } = {
          '{{name}}': recipientName,
          '{{employeeName}}': recipientName,
          '{{firstName}}': recipientName.split(' ')[0],
          '{{lastName}}': recipientName.split(' ').slice(1).join(' '),
          '{{position}}': recipientPosition,
          '{{department}}': recipientDepartment,
          '{{email}}': recipientEmail,
          '{{date}}': new Date().toLocaleDateString(),
          '{{startDate}}': new Date().toLocaleDateString()
        };
        
        for (const [key, value] of Object.entries(replacements)) {
          content = content.replace(new RegExp(key, 'g'), value);
        }
        
        data.content = content;
      }
    }
    
    const contract = await storage.createEmployeeContract(data);
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

    // Check permissions - employee can update some fields, managers can update all
    const isEmployee = contract.employeeId === user.id;
    const isManager = ['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role);
    
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
        updateData.signatureIp = req.ip;
        
        // Send notification to managers and HR after successful signing
        const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);
        
        await notifyManagersAndHROfSignedContract({
          contractId: req.params.id,
          employeeName: contract.recipientName,
          contractTitle: contract.title,
          signedDate: updateData.signedDate,
          signature: updateData.signature
        });
        
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
      const updateData = { ...req.body };
      
      // Update sent date if status changes to SENT and notify recipient
      if (updateData.status === 'SENT' && contract.status === 'DRAFT') {
        updateData.sentDate = new Date();
        
        const updatedContract = await storage.updateEmployeeContract(req.params.id, updateData);
        
        // Send notification to the recipient
        await notifyRecipientOfNewContract(
          contract.recipientEmail,
          contract.recipientName,
          contract.title,
          req.params.id
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
    const { signature } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Signature required' });
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
    
    const updatedContract = await storage.updateEmployeeContract(req.params.id, {
      status: 'SIGNED',
      signature,
      signatureIp: req.ip,
      signedDate: new Date()
    });
    
    // Here you would send notification to HR/manager about signed contract
    
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
    
    // Here you would send notification to HR/manager about rejected contract
    
    res.json(updatedContract);
  } catch (error) {
    console.error('Error rejecting contract:', error);
    res.status(500).json({ error: 'Failed to reject contract' });
  }
});

export default router;