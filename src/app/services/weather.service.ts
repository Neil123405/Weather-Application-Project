import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiKey = '';
  private baseUrl = 'https://api.tomorrow.io/v4/weather/realtime';

  constructor(private http: HttpClient) { }

  public async cacheData(key: string, data: any) {
    await Preferences.set({
      key,
      value: JSON.stringify(data)
    });
  }

  public async getCachedData(key: string): Promise<any> {
    const result = await Preferences.get({ key });
    return result.value ? JSON.parse(result.value) : null;
  }

  getCurrentWeather(lat: number, lon: number): Observable<any> {
    const url = `${this.baseUrl}?location=${lat},${lon}&apikey=${this.apiKey}&_ts=${new Date().getTime()}`;
    return this.http.get(url).pipe(
      map((response: any) => {
        const data = {
          location: `Lat: ${lat}, Lon: ${lon}`,
          temp: response.data.values.temperature,
          humidity: response.data.values.humidity,
          windSpeed: response.data.values.windSpeed || "N/A",
          weatherCode: response.data.values.weatherCode || 0
        };
        console.log("✅ Processed Weather Data Current Weather:", data); 
        this.cacheData('currentWeather', data);
        return data;
      }),
      catchError(error => {
        console.error("⚠️ API Fetch Error:", error);  
        return this.getCachedData('currentWeather');
      })
    );
  }

  getHourlyWeather(lat: number, lon: number): Observable<any> {
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&apikey=${this.apiKey}`;
    return this.http.get(url).pipe(
      map((response: any) => {
        if(!response.timelines || !response.timelines.hourly) {
          return[];
        }
        const hourly = response.timelines.hourly.slice(0,24).map((hour: any) => ({
          time: hour.time,
          temp: hour.values.temperature,
          condition: hour.values.weatherCode,
          humidity: hour.values.humidity,
          windSpeed: hour.values.windSpeed,
          weatherCode: hour.values.weatherCode
        }));
        console.log("✅ Processed Weather Data Hourly Weather:", hourly); 
        this.cacheData('hourlyForecast', hourly);
        return hourly;
      }),
      catchError(error => {
        console.error("⚠️ API Fetch Error:", error);  
        return this.getCachedData('hourlyForecast');
      })
    );
  }

  getFiveDayForecast(lat: number, lon: number): Observable<any> {
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&apikey=${this.apiKey}&timesteps=1d`;
    return this.http.get(url).pipe(
      map((response: any) => {
        const forecast = response.timelines.daily.map((day: any) => ({
          date: day.time,
          tempMin: day.values.temperatureMin,
          tempMax: day.values.temperatureMax,
          condition: day.values.weatherCode,
          humidity: day.values.humidityAvg,
          windSpeed: day.values.windSpeedAvg,
          weatherCode: day.values.weatherCodeMax
        }));
        console.log("✅ Processed Weather Data Five Day Forecast:", forecast); 
        this.cacheData('fiveDayForecast', forecast);
        return forecast;
      }),
      catchError(error => {
        console.error("⚠️ API Fetch Error:", error);  // Debugging
        return this.getCachedData('fiveDayForecast');
      })
    );
  }

  getWeatherByCity(city: string): Observable<any> {
    const url = `${this.baseUrl}?location=${encodeURIComponent(city)}&apikey=${this.apiKey}`;
    return this.http.get(url).pipe(
      map((response: any) => {
        return {
          location: city,
          temp: response.data.values.temperature,
          humidity: response.data.values.humidity,
          windSpeed: response.data.values.windSpeed || "N/A",
          weatherCode: response.data.values.weatherCode || "N/A"
        };
      })
    )
  }

  getHourlyWeatherByCity(city: string): Observable<any> {
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${encodeURIComponent(city)}&apikey=${this.apiKey}&timesteps=1h`;
    return this.http.get(url).pipe(
        map((response: any) => {
            if (!response.timelines || !response.timelines.hourly) {
                return [];
            }
            const hourly = response.timelines.hourly
                .slice(0, 24) // ✅ Ensures only 24-hour forecast
                .map((hour: any) => ({
                    time: hour.time,
                    temp: hour.values.temperature,
                    condition: hour.values.weatherCode,
                    humidity: hour.values.humidity,
                    windSpeed: hour.values.windSpeed,
                    weatherCode: hour.values.weatherCode
                }));
            return hourly;
        }),
    );
  }

  getFiveDayForecastByCity(city: string): Observable<any> {
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${encodeURIComponent(city)}&apikey=${this.apiKey}&timesteps=1d`;
    return this.http.get(url).pipe(
      map((response: any) => {
        return response.timelines.daily.map((day: any) => ({
          date: day.time,
          tempMin: day.values.temperatureMin,
          tempMax: day.values.temperatureMax,
          humidity: day.values.humidityAvg,
          windSpeed: day.values.windSpeedAvg,
          weatherCode: day.values.weatherCodeMax
        }));
      })
    );
  }
  
}
