import { Component, OnInit } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

import { WeatherService } from '../services/weather.service';

import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  location = { lat: 0, lon: 0 };
  weatherData: any;
  forecastData: any;
  hourlyData: any;
  
  manualLocation: string = '';

  error: string = '';
  notificationsEnabled: boolean = true;

  tempUnit: string = 'C';

  isDarkMode = false;

  async ngOnInit() {
    await this.loadSettings();
    this.checkPermissionsAndGetLocation();
  }

  constructor(private weatherService: WeatherService, private configService: ConfigService) {}

  async fetchWeather() {
    this.error = '';
    this.weatherData = null;
    const status = await Network.getStatus();
    if(!status.connected) {
      await this.getCurrentLocation();
      this.weatherData = await this.weatherService.getCachedData('currentWeather');
      this.hourlyData = await this.weatherService.getCachedData('hourlyForecast');
      this.forecastData = await this.weatherService.getCachedData('fiveDayForecast');
      if (this.weatherData) {
        this.weatherData.originalTemp = this.weatherData.temp;
      }
    
      if (this.hourlyData) {
        this.hourlyData = this.hourlyData.map((hour: any) => ({
          ...hour,
          originalTemp: hour.temp
        }));
      }
    
      if (this.forecastData) {
        this.forecastData = this.forecastData.map((day: any) => ({
          ...day,
          originalTempMin: day.tempMin,
          originalTempMax: day.tempMax
        }));
      }
      if(!this.weatherData) {
        this.error = "No cached weather data available.";
      } else {
        this.applyTemperatureConversion(); 
      }
      return;
    }
    if(this.manualLocation.trim()) {
      this.weatherService.getWeatherByCity(this.manualLocation).subscribe(data => {
        this.weatherData = {
          ...data,
          originalTemp: data.temp  
        };
        this.applyTemperatureConversion();
      });
      this.weatherService.getHourlyWeatherByCity(this.manualLocation).subscribe(hourly => {
        this.hourlyData = hourly.map((hour: any) => ({
            ...hour,
            originalTemp: hour.temp
        })); 
        this.applyTemperatureConversion();
      });
      this.weatherService.getFiveDayForecastByCity(this.manualLocation).subscribe(forecast => {
        this.forecastData = forecast.map((day: any) => ({
            ...day,
            originalTempMin: day.tempMin,
            originalTempMax: day.tempMax
        })); 
        this.applyTemperatureConversion();
      });
    } else {
      await this.getCurrentLocation();

      this.weatherService.getCurrentWeather(this.location.lat, this.location.lon)
      .subscribe(
        data => {
           this.weatherData = {
            ...data,
            originalTemp: data.temp  
          };          
          this.applyTemperatureConversion();
          console.log(this.weatherData);
        },
        error => {
          alert("Failed to fetch weather. Check your internet connection.");
        }
      );
      this.weatherService.getHourlyWeather(this.location.lat, this.location.lon)
        .subscribe(
          hourly => {
            this.hourlyData = hourly.map((hour: any) => ({
              ...hour,
              originalTemp: hour.temp,
            })); 
            this.applyTemperatureConversion();
            console.log(this.hourlyData);
          },
          error => {
            alert("Error fetching hourly forecast");
          }
        );
      this.weatherService.getFiveDayForecast(this.location.lat, this.location.lon)
        .subscribe(
          forecast => {
            this.forecastData = forecast.map((day: any) => ({
              ...day,
              originalTempMin: day.tempMin,
              originalTempMax: day.tempMax
            }));
            this.applyTemperatureConversion();            
            console.log(this.forecastData);
          }, 
          error => {
            alert("Error fetching forecast");
          }
        );
    }            
  }

  async checkPermissionsAndGetLocation() {
    if(Capacitor.isNativePlatform()) {
      const permStatus = await Geolocation.checkPermissions();
      if(permStatus.location === 'denied') {
        alert('Location permission is denied. Please enable it in Settings');
        return;
      }
      if(permStatus.location === 'prompt') {
        const request = await Geolocation.requestPermissions();
        if (request.location === 'denied') {
          alert('You must allow location permissions');
          return;
        }
      }
    }
    await this.getCurrentLocation();
  }

  private lastFetchedLocation: { lat: number, lon: number } | null = null;
  private lastFetchTime: number = 0;
  private fetchCooldown: number = 30000; // 30 seconds cooldown

  async getCurrentLocation() {
    try {      
      const status = await Network.getStatus();
      if(!status.connected) {
        alert("No internet connection. Weather data may be unavailable.");
        
        const savedLocation = await Preferences.get({ key: 'lastKnownLocation' });
        if (savedLocation.value) {
          const parsed = JSON.parse(savedLocation.value);
          this.location.lat = parsed.lat;
          this.location.lon = parsed.lon;
        } else {
          // 🟥 Default location fallback
          this.location.lat = 10.3157;
          this.location.lon = 123.8854;
        }
      } else {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
        const newLat = position.coords.latitude;
        const newLon = position.coords.longitude;

        const now = Date.now();
        if (this.lastFetchedLocation) {
          const distance = this.calculateDistance(
            this.lastFetchedLocation.lat, this.lastFetchedLocation.lon, newLat, newLon
          );
          if (distance < 0.5) {
            console.log("Location change is minor, skipping update.");
            return;
          }
        }
    
        // ✅ 2. Apply cooldown to prevent frequent updates
        if (now - this.lastFetchTime < this.fetchCooldown) {
          console.log("Cooldown active, skipping weather fetch.");
          return;
        }

        await Preferences.set({
          key: 'lastKnownLocation',
          value: JSON.stringify({ lat: newLat, lon: newLon })
        });
        this.lastFetchedLocation = { lat: newLat, lon: newLon };
        this.lastFetchTime = now;

        this.location.lat = newLat;
        this.location.lon = newLon;
        await this.updateLocation(this.location.lat, this.location.lon);
      }      
    } catch (error) {
      alert("Could not retrieve location. Ensure GPS is enabled.");
      const savedLocation = await Preferences.get({ key: 'lastKnownLocation' });
      if (savedLocation.value) {
        const parsed = JSON.parse(savedLocation.value);
        this.location.lat = parsed.lat;
        this.location.lon = parsed.lon;
      } else {
        // 🟥 Default location fallback
        this.location.lat = 10.3157;
        this.location.lon = 123.8854;
      }
    }
  }

  getWeatherCondition(code: number): string {
    const conditions: { [key: number]: string } = {
      0: "Unknown",
      1000: "Clear",
      1100: "Mostly Clear",
      1101: "Partly Cloudy",
      1102: "Mostly Cloudy",
      1001: "Cloudy",
      2000: "Fog",
      2100: "Light Fog",
      4000: "Drizzle",
      4200: "Light Rain",
      4001: "Rain",
      4201: "Heavy Rain",
      5001: "Flurries",
      5100: "Light Snow",
      5000: "Snow",
      5101: "Heavy Snow",
      6000: "Freezing Drizzle",
      6200: "Light Freezing Rain",
      6001: "Freezing Rain",
      6201: "Heavy Freezing Rain",
      7000: "Ice Pellets",
      7101: "Heavy Ice Pellets",
      7102: "Light Ice Pellets",
      8000: "Thunderstorm"
    };
    return conditions[code] || "Unknown Condition";
  }

  private toggleCooldown = false; // Prevents multiple requests

  async toggleNotifications(event: any) {
    if (this.toggleCooldown) {
      console.log("Cooldown active, skipping toggle.");
      return;
    }
  
    this.toggleCooldown = true; // Block multiple requests
    this.notificationsEnabled = event.detail.checked;
  
    try {
      await this.configService.updateNotificationPreference(this.notificationsEnabled);
      console.log('Notification preference updated');
  
      await Preferences.set({
        key: 'settings',
        value: JSON.stringify({ notification: this.notificationsEnabled, tempUnit: this.tempUnit, isDarkMode: this.isDarkMode }),
      });
  
    } catch (err) {
      console.error('Error updating preference:', err);
    }
  
    // ✅ Add a short delay before allowing the next toggle
    setTimeout(() => {
      this.toggleCooldown = false;
    }, 500);
  }

  async loadSettings() {
    const settings = await Preferences.get({ key: 'settings' });
    if (settings.value) {
      const parsedSettings = JSON.parse(settings.value);      
      this.notificationsEnabled = parsedSettings.notification ?? false;
      this.tempUnit = parsedSettings.tempUnit || 'C';
      this.isDarkMode =  parsedSettings.isDarkMode ?? false;
      this.applyDarkMode();
    }
  }

  async toggleTemperatureUnit() {
    this.tempUnit = this.tempUnit === 'C' ? 'F' : 'C';
    await Preferences.set({
      key: 'settings',
      value: JSON.stringify({ notification: this.notificationsEnabled , tempUnit: this.tempUnit, isDarkMode: this.isDarkMode })
    });
    this.applyTemperatureConversion(); 
  }

  applyTemperatureConversion() {
    if (!this.weatherData) 
      return;
    if (this.weatherData) {
      this.weatherData.temp = this.tempUnit === 'F'
        ? (this.weatherData.originalTemp * 9/5) + 32
        : this.weatherData.originalTemp;
    } else {
      console.warn("⚠️ No originalTemp found for current weather.");
    }
    if (!this.hourlyData)
      return;
    if (this.hourlyData) {
      this.hourlyData = this.hourlyData.map((hour: any) => {
        return {
          ...hour,
          temp: this.tempUnit === 'F'
            ? (hour.originalTemp * 9/5) + 32
            : hour.originalTemp
        };
      });
    } else {
      console.warn("⚠️ No hourly weather.");
    }
    if (!this.forecastData)
      return;
    if (this.forecastData) {
      this.forecastData = this.forecastData.map((day: any) => ({
        ...day,
        tempMin: this.tempUnit === 'F'
          ? (day.originalTempMin * 9/5) + 32
          : day.originalTempMin,
        tempMax: this.tempUnit === 'F'
          ? (day.originalTempMax * 9/5) + 32
          : day.originalTempMax
      }));
    } else {
      console.warn("⚠️ No forecast weather.");
    }
  }

  async updateLocation(lat: number, lon: number) {
  
    await this.configService.updateUserLocationOnGitHub(lat, lon);
    
    this.getCurrentLocation(); 
  }
  

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }
  
  degToRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  applyDarkMode() {
    if (this.isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  async toggleDarkMode(event: any) {
  
    this.isDarkMode = event.detail.checked;
  
    try {
  
      await Preferences.set({
        key: 'settings',
        value: JSON.stringify({ notification: this.notificationsEnabled, tempUnit: this.tempUnit, isDarkMode: this.isDarkMode }),
      });
  
    } catch (err) {
      console.error('Error updating preference:', err);
    }
    this.applyDarkMode();

  }

}
