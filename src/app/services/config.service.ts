import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private repo = 'anon446/push';  
  private token = ''; 
  private configUrl = `https://api.github.com/repos/${this.repo}/contents/config.json`;

  constructor(private http: HttpClient) {}

  async updateNotificationPreference(enabled: boolean) {
    try {
      const fileData: any = await this.http.get(this.configUrl).toPromise();
      if (!fileData.sha) throw new Error('Failed to retrieve file SHA');
  
      const sha = fileData.sha;
  
      
      const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify({ notificationsEnabled: enabled }, null, 2))));
  
      
      const response = await this.http.put(this.configUrl, {
        message: 'Update notification preference',
        content: updatedContent,
        sha,
        branch: 'main'
      }, {
        headers: { Authorization: `Bearer ${this.token}` } // 🔹 Changed `token` to `Bearer`
      }).toPromise();
  
      console.log('✅ Notification preference updated:', response);
      return response;
    } catch (error) {
      console.error('❌ Error updating notification preference:', error);
      throw error; 
    }
  }
  
  async updateUserLocationOnGitHub(lat: number, lon: number) {
    const token = ''; 
    const repo = 'anon446/push';
    const path = 'location.json';

      // Step 1: Fetch the latest sha of the file
    const fileResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let latestSha = null;

    if (fileResponse.ok) {
      const fileData = await fileResponse.json();
      latestSha = fileData.sha; // Extract latest sha
    } else {
      console.warn("File not found, creating a new one...");
    }
  
    const content = JSON.stringify({ lat, lon });
    const base64Content = btoa(content); // Convert to Base64 (required by GitHub API)
  
     // Step 3: Update or create the file
    const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update location',
        content: base64Content,
        sha: latestSha, // Include sha if updating
        branch: 'main'
      })
    });

    if (updateResponse.ok) {
      console.log('✅ Location updated on GitHub');
    } else {
      console.error('❌ Failed to update location:', await updateResponse.json());
    }
    
  }

}
