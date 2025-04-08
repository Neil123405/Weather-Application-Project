import { Component } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false
})
export class AppComponent {
  constructor() {
    this.initPushNotifications();
  }

  initPushNotifications() {

    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });


    PushNotifications.addListener('registration', (token: Token) => {
      console.log('FCM Token:', token.value);alert('FCM Token: ' + token.value);  
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Notification received:', notification);
    });


    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Notification action performed:', action);
    });
  }
}
