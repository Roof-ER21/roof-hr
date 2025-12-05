interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const status = response.status;
    
    try {
      const data = await response.json();
      
      if (!response.ok) {
        return {
          error: data.error || `HTTP ${status}: ${response.statusText}`,
          status,
        };
      }
      
      return {
        data,
        status,
      };
    } catch (error) {
      return {
        error: `Failed to parse response: ${error}`,
        status,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        error: `Network error: ${error}`,
        status: 0,
      };
    }
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        error: `Network error: ${error}`,
        status: 0,
      };
    }
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        error: `Network error: ${error}`,
        status: 0,
      };
    }
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        error: `Network error: ${error}`,
        status: 0,
      };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        error: `Network error: ${error}`,
        status: 0,
      };
    }
  }

  // Specific API methods
  
  // Authentication
  async login(email: string, password: string) {
    return this.post<{ token: string; user: any }>('/api/auth/login', { email, password });
  }

  async logout() {
    return this.post('/api/auth/logout');
  }

  async register(userData: any) {
    return this.post<{ token: string; user: any }>('/api/auth/register', userData);
  }

  // Users
  async getUsers() {
    return this.get<any[]>('/api/users');
  }

  async getUser(id: string) {
    return this.get<any>(`/api/users/${id}`);
  }

  async updateUser(id: string, userData: any) {
    return this.patch<any>(`/api/users/${id}`, userData);
  }

  async deleteUser(id: string) {
    return this.delete(`/api/users/${id}`);
  }

  // PTO
  async getPTORequests() {
    return this.get<any[]>('/api/pto');
  }

  async createPTORequest(ptoData: any) {
    return this.post<any>('/api/pto', ptoData);
  }

  async updatePTORequest(id: string, ptoData: any) {
    return this.patch<any>(`/api/pto/${id}`, ptoData);
  }

  // Check-ins
  async getCheckins() {
    return this.get<any[]>('/api/checkins');
  }

  async createCheckin(checkinData: any) {
    return this.post<any>('/api/checkins', checkinData);
  }

  // Safety
  async getSafetyIncidents() {
    return this.get<any[]>('/api/safety/incidents');
  }

  async createSafetyIncident(incidentData: any) {
    return this.post<any>('/api/safety/incidents', incidentData);
  }

  async getTrainingRecords() {
    return this.get<any[]>('/api/safety/training');
  }

  async createTrainingRecord(trainingData: any) {
    return this.post<any>('/api/safety/training', trainingData);
  }

  // Recruiting
  async getCandidates() {
    return this.get<any[]>('/api/candidates');
  }

  async createCandidate(candidateData: any) {
    return this.post<any>('/api/candidates', candidateData);
  }

  async updateCandidate(id: string, candidateData: any) {
    return this.patch<any>(`/api/candidates/${id}`, candidateData);
  }

  async getInterviews() {
    return this.get<any[]>('/api/interviews');
  }

  async createInterview(interviewData: any) {
    return this.post<any>('/api/interviews', interviewData);
  }

  // Documents
  async getDocuments() {
    return this.get<any[]>('/api/documents');
  }

  async createDocument(documentData: any) {
    return this.post<any>('/api/documents', documentData);
  }

  async updateDocument(id: string, documentData: any) {
    return this.patch<any>(`/api/documents/${id}`, documentData);
  }

  // Meetings
  async getMeetings() {
    return this.get<any[]>('/api/meetings');
  }

  async createMeeting(meetingData: any) {
    return this.post<any>('/api/meetings', meetingData);
  }

  async updateMeeting(id: string, meetingData: any) {
    return this.patch<any>(`/api/meetings/${id}`, meetingData);
  }

  // Tasks
  async getTasks() {
    return this.get<any[]>('/api/tasks');
  }

  async createTask(taskData: any) {
    return this.post<any>('/api/tasks', taskData);
  }

  async updateTask(id: string, taskData: any) {
    return this.patch<any>(`/api/tasks/${id}`, taskData);
  }

  async deleteTask(id: string) {
    return this.delete(`/api/tasks/${id}`);
  }

  // Settings
  async getCompanySettings() {
    return this.get<any>('/api/settings');
  }

  async createCompanySettings(settingsData: any) {
    return this.post<any>('/api/settings', settingsData);
  }

  async updateCompanySettings(id: string, settingsData: any) {
    return this.patch<any>(`/api/settings/${id}`, settingsData);
  }

  // Dashboard
  async getDashboardMetrics() {
    return this.get<any>('/api/dashboard/metrics');
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export the class for potential custom instances
export { ApiClient };

// Export helper function for React Query
export const createQueryFn = (endpoint: string) => {
  return async () => {
    const response = await apiClient.get(endpoint);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.data;
  };
};

// Export mutation helper for React Query
export const createMutationFn = (method: 'post' | 'put' | 'patch' | 'delete', endpoint: string) => {
  return async (data?: any) => {
    const response = await apiClient[method](endpoint, data);
    if (response.error) {
      throw new Error(response.error);
    }
    return response.data;
  };
};
