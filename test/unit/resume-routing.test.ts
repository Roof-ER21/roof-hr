import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  candidates: [] as any[],
  create: vi.fn(), update: vi.fn(), upload: vi.fn(), parse: vi.fn(),
  territories: [{ id:'east', name:'East', region:'PA', isActive:true }, { id:'old', name:'Old', region:'VA', isActive:false }],
}));
vi.mock('../../server/storage', () => ({ storage: {
  getAllCandidates: async () => mock.candidates,
  getAllTerritories: async () => mock.territories,
  getTerritoryById: async (id: string) => mock.territories.find(t => t.id === id),
  createCandidate: mock.create, updateCandidate: mock.update,
  getUserById: async () => null,
} }));
vi.mock('../../server/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user={id:'manager',role:'MANAGER'};next(); },
  requireManager: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../server/services/google-drive-service', () => ({ googleDriveService: {
  isInitialized: () => true, findFolderByName: async () => ({id:'folder'}), uploadFile: mock.upload,
} }));
vi.mock('../../server/services/google-sync-enhanced', () => ({ googleSyncEnhanced:{} }));
vi.mock('../../server/services/susan-ai/resume-parser', () => ({ SusanResumeParser: class { parseResume = mock.parse; } }));
vi.mock('../../server/services/resume-text-extractor', () => ({ extractResumeText: async () => 'Synthetic resume' }));
import router from '../../server/routes/google-drive-uploads';
import { resumeSource, resumeMatch } from '../../server/services/resume-routing';
const app=express();app.use(express.json());app.use(router);
beforeEach(() => {
  vi.clearAllMocks();mock.candidates=[];
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY','synthetic-test-only');
  mock.parse.mockResolvedValue({firstName:'Example',lastName:'Person',email:'example@example.test',skills:[]});
  mock.upload.mockResolvedValue({id:'file',webViewLink:'https://example.test/synthetic.pdf'});
  mock.create.mockImplementation(async data => ({id:'new',...data}));
});
afterEach(() => vi.unstubAllEnvs());
function upload(region='east') { return request(app).post('/api/resumes/upload').field('category','field-tech').field('territoryId',region).field('transferVersion','2').attach('resume',Buffer.from('%PDF-1.7 synthetic'),{filename:'Indeed-abc123--Example_Person.pdf',contentType:'application/pdf'}); }
it('saves the selected category and active region without assigning a sourcer', async () => {
  const res=await upload();expect(res.status).toBe(200);
  expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({position:'Field Tech',territoryId:'east'}));
  expect(mock.create.mock.calls[0][0].assignedTo).toBeUndefined();expect(mock.update).not.toHaveBeenCalled();
  expect(res.body.candidate.territoryId).toBe('east');
});
it.each(['missing','old'])('rejects invalid region %s before parsing or writing',async region => {
  const res=await upload(region);expect(res.status).toBe(400);expect(mock.parse).not.toHaveBeenCalled();expect(mock.upload).not.toHaveBeenCalled();expect(mock.create).not.toHaveBeenCalled();
});
it('returns a structured duplicate hold before uploading a file or creating a candidate', async () => {
  mock.candidates=[{id:'existing',email:'EXAMPLE@example.test',isArchived:true}];
  const res=await upload();expect(res.status).toBe(409);expect(res.body.code).toBe('CANDIDATE_EXISTS');expect(res.body.matchType).toBe('contact');
  expect(mock.upload).not.toHaveBeenCalled();expect(mock.create).not.toHaveBeenCalled();expect(mock.update).not.toHaveBeenCalled();
});
it('lists previous pilot uploads in the correct category with region and supports paging', async () => {
  mock.candidates=Array.from({length:23},(_,i) => ({id:String(i),firstName:'Example',position:'Field Tech',notes:'Auto-created from resume upload (Indeed-abc123--Example.pdf). Skills:',appliedDate:new Date(2026,0,i+1),territoryId:'east'}));
  mock.candidates.push({id:'office',position:'Office',notes:'Auto-created from resume upload (x.pdf)',appliedDate:new Date()});
  const res=await request(app).get('/api/resumes/recent?category=field-tech&limit=20&offset=20');
  expect(res.body.total).toBe(23);expect(res.body.candidates).toHaveLength(3);expect(res.body.candidates[0].source).toBe('Resume Upload');expect(res.body.candidates[0].territory.name).toBe('East');
});
it('advertises active destinations and the matching transfer contract',async () => {
  const res=await request(app).get('/api/resumes/transfer-options');expect(res.body.transferVersion).toBe(2);expect(res.body.territories).toHaveLength(1);expect(res.body.categories['field-tech']).toBe('Field Tech');
});
it('recognizes persisted upload/sync prefixes without classifying ordinary notes as uploads',() => {
  expect(resumeSource({notes:'Synced from Google Drive. Original file: x.pdf'})).toBe('Google Drive Sync');
  expect(resumeSource({notes:'Discussed resume upload with candidate'})).toBeNull();
  expect(resumeMatch([{id:'old',notes:'Auto-created from resume upload (Indeed-abc123--Example.pdf)'}],'Indeed-abc123--Example.pdf',{})).toEqual({candidateId:'old',matchType:'source'});
});
