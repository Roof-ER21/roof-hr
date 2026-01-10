import fetch from 'node-fetch';

interface LightpdfTaskResponse {
  status: number;
  message: string;
  data?: {
    task_id?: string;
    file?: string;
    state?: number;
    progress?: number;
  };
}

export class LightpdfService {
  private apiKey: string | undefined;
  private baseUrl = 'https://techhk.aoscdn.com/api/tasks/document/pdfedit';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LIGHTPDF_API_KEY;
  }

  isEnabled() {
    return !!this.apiKey;
  }

  private headers() {
    return {
      'X-API-KEY': this.apiKey || '',
    };
  }

  async createTaskWithUrl(fileUrl: string, type: string = 'compress'): Promise<string | null> {
    if (!this.isEnabled()) return null;
    const formData = new (require('form-data'))();
    formData.append('type', type);
    formData.append('url', fileUrl);

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers(),
      body: formData as any,
    });
    const json = (await res.json()) as LightpdfTaskResponse;
    if (json.status !== 200 || !json.data?.task_id) {
      console.error('[LightPDF] Failed to create task:', json);
      return null;
    }
    return json.data.task_id;
  }

  async pollResult(taskId: string, timeoutMs: number = 15000, intervalMs: number = 1000): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${this.baseUrl}/${taskId}`, {
        headers: this.headers(),
      });
      const json = (await res.json()) as LightpdfTaskResponse;
      if (json.status !== 200) {
        console.error('[LightPDF] Poll failed:', json);
        return null;
      }
      const state = json.data?.state ?? 0;
      if (state === 1 && json.data?.file) {
        return json.data.file;
      }
      if (state < 0) {
        console.error('[LightPDF] Task failed:', json);
        return null;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    console.warn('[LightPDF] Poll timed out');
    return null;
  }

  /**
   * Convenience: convert an existing file URL to a LightPDF-hosted URL for viewing.
   */
  async getViewLink(fileUrl: string): Promise<string | null> {
    const taskId = await this.createTaskWithUrl(fileUrl, 'compress');
    if (!taskId) return null;
    return await this.pollResult(taskId);
  }
}

export const lightpdfService = new LightpdfService();
