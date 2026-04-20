import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { environment } from '../../../../environments/environment';

interface OrderNotification {
  orderId: string;
  orderNo: number;
  type: string;
  message: string;
  itemName?: string;
  orderClosed: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  orderable: boolean;
  price?: number;
  imagePath?: string;
  description?: string;
  allergenIds?: string[];
  children: MenuItem[];
}

interface Allergen {
  id: string;
  number: number;
  name: string;
  active: boolean;
}

interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

interface ApiOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  note?: string;
  paid?: boolean;
}

interface ApiOrder {
  id: string;
  orderNo: number;
  status: string;
  note?: string;
  nickname?: string;
  needsPayment?: boolean;
  registrationId?: string;
  items: ApiOrderItem[];
}

interface GuestOrders {
  nickname: string;
  registrationId: string;
  orders: ApiOrder[];
  total: number;
}

interface EventData {
  id: string;
  name: string;
  logoPath?: string;
}

interface PendingTeamRegistration {
  id: string;
  orderPointId: string;
  orderPointName: string;
  validationStatus: string;
  createdAt: string;
  nickname?: string;
}

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
})
export class RegistrationComponent implements OnInit, OnDestroy {
  eventId: string = '';
  orderPointId: string = '';
  registrationResponse: any = null;
  loading: boolean = false;
  error: string = '';

  // Navigation
  menuOpen: boolean = false;
  activeView: 'menu' | 'orders' | 'checkout' | 'team' | 'waiting' | 'nickname' | 'login' | 'payments' = 'menu';
  orderPointPayLater: boolean = false;
  orderPointMenuId: string | null = null;
  categoryNavExpanded: boolean = false;

  // Validation polling
  private validationPollInterval: any = null;

  // Menu
  menuItems: MenuItem[] = [];
  allergens: Allergen[] = [];
  loadingMenu: boolean = false;
  quantities: Map<string, number> = new Map();
  placingOrder: boolean = false;
  orderStatus: string = '';

  // Orders
  orders: ApiOrder[] = [];
  orderPointOrders: ApiOrder[] = []; // All orders at the order point (for payLater)
  loadingOrders: boolean = false;
  ordersGroupMode: 'table' | 'guest' = 'table';
  ordersViewMode: 'total' | 'order' = 'total';

  // Event data
  eventData: EventData | null = null;

  // WebSocket and notifications
  private stompClient: Client | null = null;
  notifications: OrderNotification[] = [];
  activeOrderIds: Set<string> = new Set();
  connected: boolean = false;
  private audioContext: AudioContext | null = null;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  // Toast
  showingToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';

  // Payment choice dialog
  showPaymentChoice: boolean = false;
  nickname: string = '';
  firstName: string = '';
  lastName: string = '';
  customerPhone: string = '';

  countries = [
    { name: 'Romania', code: '+40', flag: '🇷🇴', placeholder: '7XX XXX XXX' },
    { name: 'Afghanistan', code: '+93', flag: '🇦🇫', placeholder: '7X XXX XXXX' },
    { name: 'Albania', code: '+355', flag: '🇦🇱', placeholder: '6X XXX XXXX' },
    { name: 'Algeria', code: '+213', flag: '🇩🇿', placeholder: '5XX XX XX XX' },
    { name: 'American Samoa', code: '+1684', flag: '🇦🇸', placeholder: 'XXX XXXX' },
    { name: 'Andorra', code: '+376', flag: '🇦🇩', placeholder: 'XXX XXX' },
    { name: 'Angola', code: '+244', flag: '🇦🇴', placeholder: '9XX XXX XXX' },
    { name: 'Anguilla', code: '+1264', flag: '🇦🇮', placeholder: 'XXX XXXX' },
    { name: 'Antigua and Barbuda', code: '+1268', flag: '🇦🇬', placeholder: 'XXX XXXX' },
    { name: 'Argentina', code: '+54', flag: '🇦🇷', placeholder: 'XX XXXX XXXX' },
    { name: 'Armenia', code: '+374', flag: '🇦🇲', placeholder: 'XX XXX XXX' },
    { name: 'Aruba', code: '+297', flag: '🇦🇼', placeholder: 'XXX XXXX' },
    { name: 'Australia', code: '+61', flag: '🇦🇺', placeholder: '4XX XXX XXX' },
    { name: 'Austria', code: '+43', flag: '🇦🇹', placeholder: '6XX XXX XXXX' },
    { name: 'Azerbaijan', code: '+994', flag: '🇦🇿', placeholder: 'XX XXX XX XX' },
    { name: 'Bahamas', code: '+1242', flag: '🇧🇸', placeholder: 'XXX XXXX' },
    { name: 'Bahrain', code: '+973', flag: '🇧🇭', placeholder: 'XXXX XXXX' },
    { name: 'Bangladesh', code: '+880', flag: '🇧🇩', placeholder: '1XXX XXXXXX' },
    { name: 'Barbados', code: '+1246', flag: '🇧🇧', placeholder: 'XXX XXXX' },
    { name: 'Belarus', code: '+375', flag: '🇧🇾', placeholder: 'XX XXX XX XX' },
    { name: 'Belgium', code: '+32', flag: '🇧🇪', placeholder: '4XX XX XX XX' },
    { name: 'Belize', code: '+501', flag: '🇧🇿', placeholder: 'XXX XXXX' },
    { name: 'Benin', code: '+229', flag: '🇧🇯', placeholder: 'XX XX XX XX' },
    { name: 'Bermuda', code: '+1441', flag: '🇧🇲', placeholder: 'XXX XXXX' },
    { name: 'Bhutan', code: '+975', flag: '🇧🇹', placeholder: '17 XXX XXX' },
    { name: 'Bolivia', code: '+591', flag: '🇧🇴', placeholder: 'X XXX XXXX' },
    { name: 'Bosnia and Herzegovina', code: '+387', flag: '🇧🇦', placeholder: '6X XXX XXX' },
    { name: 'Botswana', code: '+267', flag: '🇧🇼', placeholder: '7X XXX XXX' },
    { name: 'Brazil', code: '+55', flag: '🇧🇷', placeholder: 'XX XXXXX XXXX' },
    { name: 'Brunei', code: '+673', flag: '🇧🇳', placeholder: 'XXX XXXX' },
    { name: 'Bulgaria', code: '+359', flag: '🇧🇬', placeholder: '8X XXX XXXX' },
    { name: 'Burkina Faso', code: '+226', flag: '🇧🇫', placeholder: 'XX XX XX XX' },
    { name: 'Burundi', code: '+257', flag: '🇧🇮', placeholder: 'XX XX XXXX' },
    { name: 'Cabo Verde', code: '+238', flag: '🇨🇻', placeholder: 'XXX XX XX' },
    { name: 'Cambodia', code: '+855', flag: '🇰🇭', placeholder: 'XX XXX XXX' },
    { name: 'Cameroon', code: '+237', flag: '🇨🇲', placeholder: 'X XXXX XXXX' },
    { name: 'Canada', code: '+1', flag: '🇨🇦', placeholder: 'XXX XXX XXXX' },
    { name: 'Cayman Islands', code: '+1345', flag: '🇰🇾', placeholder: 'XXX XXXX' },
    { name: 'Central African Republic', code: '+236', flag: '🇨🇫', placeholder: 'XX XX XX XX' },
    { name: 'Chad', code: '+235', flag: '🇹🇩', placeholder: 'XX XX XX XX' },
    { name: 'Chile', code: '+56', flag: '🇨🇱', placeholder: '9 XXXX XXXX' },
    { name: 'China', code: '+86', flag: '🇨🇳', placeholder: 'XXX XXXX XXXX' },
    { name: 'Colombia', code: '+57', flag: '🇨🇴', placeholder: 'XXX XXX XXXX' },
    { name: 'Comoros', code: '+269', flag: '🇰🇲', placeholder: 'XXX XX XX' },
    { name: 'Congo (DRC)', code: '+243', flag: '🇨🇩', placeholder: 'XX XXX XXXX' },
    { name: 'Congo (Republic)', code: '+242', flag: '🇨🇬', placeholder: 'XX XXX XXXX' },
    { name: 'Cook Islands', code: '+682', flag: '🇨🇰', placeholder: 'XX XXX' },
    { name: 'Costa Rica', code: '+506', flag: '🇨🇷', placeholder: 'XXXX XXXX' },
    { name: 'Croatia', code: '+385', flag: '🇭🇷', placeholder: '9X XXX XXXX' },
    { name: 'Cuba', code: '+53', flag: '🇨🇺', placeholder: 'X XXX XXXX' },
    { name: 'Curacao', code: '+599', flag: '🇨🇼', placeholder: 'XXX XXXX' },
    { name: 'Cyprus', code: '+357', flag: '🇨🇾', placeholder: '9X XXX XXX' },
    { name: 'Czech Republic', code: '+420', flag: '🇨🇿', placeholder: 'XXX XXX XXX' },
    { name: 'Denmark', code: '+45', flag: '🇩🇰', placeholder: 'XX XX XX XX' },
    { name: 'Djibouti', code: '+253', flag: '🇩🇯', placeholder: 'XX XX XX XX' },
    { name: 'Dominica', code: '+1767', flag: '🇩🇲', placeholder: 'XXX XXXX' },
    { name: 'Dominican Republic', code: '+1809', flag: '🇩🇴', placeholder: 'XXX XXXX' },
    { name: 'East Timor', code: '+670', flag: '🇹🇱', placeholder: 'XXXX XXXX' },
    { name: 'Ecuador', code: '+593', flag: '🇪🇨', placeholder: '9X XXX XXXX' },
    { name: 'Egypt', code: '+20', flag: '🇪🇬', placeholder: '1X XXXX XXXX' },
    { name: 'El Salvador', code: '+503', flag: '🇸🇻', placeholder: 'XXXX XXXX' },
    { name: 'Equatorial Guinea', code: '+240', flag: '🇬🇶', placeholder: 'XXX XXX XXX' },
    { name: 'Eritrea', code: '+291', flag: '🇪🇷', placeholder: 'X XXX XXX' },
    { name: 'Estonia', code: '+372', flag: '🇪🇪', placeholder: 'XXXX XXXX' },
    { name: 'Eswatini', code: '+268', flag: '🇸🇿', placeholder: 'XXXX XXXX' },
    { name: 'Ethiopia', code: '+251', flag: '🇪🇹', placeholder: '9X XXX XXXX' },
    { name: 'Falkland Islands', code: '+500', flag: '🇫🇰', placeholder: 'XXXXX' },
    { name: 'Faroe Islands', code: '+298', flag: '🇫🇴', placeholder: 'XXX XXX' },
    { name: 'Fiji', code: '+679', flag: '🇫🇯', placeholder: 'XXX XXXX' },
    { name: 'Finland', code: '+358', flag: '🇫🇮', placeholder: '4X XXX XXXX' },
    { name: 'France', code: '+33', flag: '🇫🇷', placeholder: '6 XX XX XX XX' },
    { name: 'French Guiana', code: '+594', flag: '🇬🇫', placeholder: 'XXX XX XX XX' },
    { name: 'French Polynesia', code: '+689', flag: '🇵🇫', placeholder: 'XX XX XX' },
    { name: 'Gabon', code: '+241', flag: '🇬🇦', placeholder: 'X XX XX XX' },
    { name: 'Gambia', code: '+220', flag: '🇬🇲', placeholder: 'XXX XXXX' },
    { name: 'Georgia', code: '+995', flag: '🇬🇪', placeholder: '5XX XX XX XX' },
    { name: 'Germany', code: '+49', flag: '🇩🇪', placeholder: '1XX XXXXXXX' },
    { name: 'Ghana', code: '+233', flag: '🇬🇭', placeholder: 'XX XXX XXXX' },
    { name: 'Gibraltar', code: '+350', flag: '🇬🇮', placeholder: 'XXXX XXXX' },
    { name: 'Greece', code: '+30', flag: '🇬🇷', placeholder: '6XX XXX XXXX' },
    { name: 'Greenland', code: '+299', flag: '🇬🇱', placeholder: 'XX XX XX' },
    { name: 'Grenada', code: '+1473', flag: '🇬🇩', placeholder: 'XXX XXXX' },
    { name: 'Guadeloupe', code: '+590', flag: '🇬🇵', placeholder: 'XXX XX XX XX' },
    { name: 'Guam', code: '+1671', flag: '🇬🇺', placeholder: 'XXX XXXX' },
    { name: 'Guatemala', code: '+502', flag: '🇬🇹', placeholder: 'XXXX XXXX' },
    { name: 'Guernsey', code: '+44', flag: '🇬🇬', placeholder: '7XXX XXXXXX' },
    { name: 'Guinea', code: '+224', flag: '🇬🇳', placeholder: 'XXX XX XX XX' },
    { name: 'Guinea-Bissau', code: '+245', flag: '🇬🇼', placeholder: 'XXX XXXX' },
    { name: 'Guyana', code: '+592', flag: '🇬🇾', placeholder: 'XXX XXXX' },
    { name: 'Haiti', code: '+509', flag: '🇭🇹', placeholder: 'XX XX XXXX' },
    { name: 'Honduras', code: '+504', flag: '🇭🇳', placeholder: 'XXXX XXXX' },
    { name: 'Hong Kong', code: '+852', flag: '🇭🇰', placeholder: 'XXXX XXXX' },
    { name: 'Hungary', code: '+36', flag: '🇭🇺', placeholder: '30 XXX XXXX' },
    { name: 'Iceland', code: '+354', flag: '🇮🇸', placeholder: 'XXX XXXX' },
    { name: 'India', code: '+91', flag: '🇮🇳', placeholder: 'XXXXX XXXXX' },
    { name: 'Indonesia', code: '+62', flag: '🇮🇩', placeholder: '8XX XXXX XXXX' },
    { name: 'Iran', code: '+98', flag: '🇮🇷', placeholder: '9XX XXX XXXX' },
    { name: 'Iraq', code: '+964', flag: '🇮🇶', placeholder: '7XX XXX XXXX' },
    { name: 'Ireland', code: '+353', flag: '🇮🇪', placeholder: '8X XXX XXXX' },
    { name: 'Isle of Man', code: '+44', flag: '🇮🇲', placeholder: '7XXX XXXXXX' },
    { name: 'Israel', code: '+972', flag: '🇮🇱', placeholder: '5X XXX XXXX' },
    { name: 'Italy', code: '+39', flag: '🇮🇹', placeholder: '3XX XXX XXXX' },
    { name: 'Ivory Coast', code: '+225', flag: '🇨🇮', placeholder: 'XX XX XX XX XX' },
    { name: 'Jamaica', code: '+1876', flag: '🇯🇲', placeholder: 'XXX XXXX' },
    { name: 'Japan', code: '+81', flag: '🇯🇵', placeholder: '90 XXXX XXXX' },
    { name: 'Jersey', code: '+44', flag: '🇯🇪', placeholder: '7XXX XXXXXX' },
    { name: 'Jordan', code: '+962', flag: '🇯🇴', placeholder: '7X XXX XXXX' },
    { name: 'Kazakhstan', code: '+7', flag: '🇰🇿', placeholder: '7XX XXX XX XX' },
    { name: 'Kenya', code: '+254', flag: '🇰🇪', placeholder: '7XX XXX XXX' },
    { name: 'Kiribati', code: '+686', flag: '🇰🇮', placeholder: 'XXXX XXXX' },
    { name: 'Kosovo', code: '+383', flag: '🇽🇰', placeholder: '4X XXX XXX' },
    { name: 'Kuwait', code: '+965', flag: '🇰🇼', placeholder: 'XXXX XXXX' },
    { name: 'Kyrgyzstan', code: '+996', flag: '🇰🇬', placeholder: 'XXX XXX XXX' },
    { name: 'Laos', code: '+856', flag: '🇱🇦', placeholder: '20 XX XXX XXX' },
    { name: 'Latvia', code: '+371', flag: '🇱🇻', placeholder: '2X XXX XXX' },
    { name: 'Lebanon', code: '+961', flag: '🇱🇧', placeholder: 'XX XXX XXX' },
    { name: 'Lesotho', code: '+266', flag: '🇱🇸', placeholder: 'XX XXX XXX' },
    { name: 'Liberia', code: '+231', flag: '🇱🇷', placeholder: 'XX XXX XXXX' },
    { name: 'Libya', code: '+218', flag: '🇱🇾', placeholder: '9X XXX XXXX' },
    { name: 'Liechtenstein', code: '+423', flag: '🇱🇮', placeholder: 'XXX XXX XXX' },
    { name: 'Lithuania', code: '+370', flag: '🇱🇹', placeholder: '6XX XXXXX' },
    { name: 'Luxembourg', code: '+352', flag: '🇱🇺', placeholder: '6XX XXX XXX' },
    { name: 'Macao', code: '+853', flag: '🇲🇴', placeholder: '6XXX XXXX' },
    { name: 'Madagascar', code: '+261', flag: '🇲🇬', placeholder: '3X XX XXX XX' },
    { name: 'Malawi', code: '+265', flag: '🇲🇼', placeholder: '9XX XX XX XX' },
    { name: 'Malaysia', code: '+60', flag: '🇲🇾', placeholder: '1X XXX XXXX' },
    { name: 'Maldives', code: '+960', flag: '🇲🇻', placeholder: 'XXX XXXX' },
    { name: 'Mali', code: '+223', flag: '🇲🇱', placeholder: 'XX XX XX XX' },
    { name: 'Malta', code: '+356', flag: '🇲🇹', placeholder: 'XX XX XX XX' },
    { name: 'Marshall Islands', code: '+692', flag: '🇲🇭', placeholder: 'XXX XXXX' },
    { name: 'Martinique', code: '+596', flag: '🇲🇶', placeholder: 'XXX XX XX XX' },
    { name: 'Mauritania', code: '+222', flag: '🇲🇷', placeholder: 'XX XX XX XX' },
    { name: 'Mauritius', code: '+230', flag: '🇲🇺', placeholder: 'XXXX XXXX' },
    { name: 'Mexico', code: '+52', flag: '🇲🇽', placeholder: 'XX XXXX XXXX' },
    { name: 'Micronesia', code: '+691', flag: '🇫🇲', placeholder: 'XXX XXXX' },
    { name: 'Moldova', code: '+373', flag: '🇲🇩', placeholder: '6X XXX XXX' },
    { name: 'Monaco', code: '+377', flag: '🇲🇨', placeholder: 'XX XX XX XX' },
    { name: 'Mongolia', code: '+976', flag: '🇲🇳', placeholder: 'XX XX XXXX' },
    { name: 'Montenegro', code: '+382', flag: '🇲🇪', placeholder: '6X XXX XXX' },
    { name: 'Montserrat', code: '+1664', flag: '🇲🇸', placeholder: 'XXX XXXX' },
    { name: 'Morocco', code: '+212', flag: '🇲🇦', placeholder: '6XX XXX XXX' },
    { name: 'Mozambique', code: '+258', flag: '🇲🇿', placeholder: '8X XXX XXXX' },
    { name: 'Myanmar', code: '+95', flag: '🇲🇲', placeholder: '9 XXX XXXX' },
    { name: 'Namibia', code: '+264', flag: '🇳🇦', placeholder: '8X XXX XXXX' },
    { name: 'Nauru', code: '+674', flag: '🇳🇷', placeholder: 'XXX XXXX' },
    { name: 'Nepal', code: '+977', flag: '🇳🇵', placeholder: '98XX XXXXXX' },
    { name: 'Netherlands', code: '+31', flag: '🇳🇱', placeholder: '6 XXXX XXXX' },
    { name: 'New Caledonia', code: '+687', flag: '🇳🇨', placeholder: 'XX XX XX' },
    { name: 'New Zealand', code: '+64', flag: '🇳🇿', placeholder: '2X XXX XXXX' },
    { name: 'Nicaragua', code: '+505', flag: '🇳🇮', placeholder: 'XXXX XXXX' },
    { name: 'Niger', code: '+227', flag: '🇳🇪', placeholder: 'XX XX XX XX' },
    { name: 'Nigeria', code: '+234', flag: '🇳🇬', placeholder: '8XX XXX XXXX' },
    { name: 'North Korea', code: '+850', flag: '🇰🇵', placeholder: 'XXX XXX XXXX' },
    { name: 'North Macedonia', code: '+389', flag: '🇲🇰', placeholder: '7X XXX XXX' },
    { name: 'Norway', code: '+47', flag: '🇳🇴', placeholder: 'XXX XX XXX' },
    { name: 'Oman', code: '+968', flag: '🇴🇲', placeholder: 'XXXX XXXX' },
    { name: 'Pakistan', code: '+92', flag: '🇵🇰', placeholder: '3XX XXX XXXX' },
    { name: 'Palau', code: '+680', flag: '🇵🇼', placeholder: 'XXX XXXX' },
    { name: 'Palestine', code: '+970', flag: '🇵🇸', placeholder: '5XX XX XXXX' },
    { name: 'Panama', code: '+507', flag: '🇵🇦', placeholder: 'XXXX XXXX' },
    { name: 'Papua New Guinea', code: '+675', flag: '🇵🇬', placeholder: 'XXX XXXX' },
    { name: 'Paraguay', code: '+595', flag: '🇵🇾', placeholder: '9XX XXX XXX' },
    { name: 'Peru', code: '+51', flag: '🇵🇪', placeholder: '9XX XXX XXX' },
    { name: 'Philippines', code: '+63', flag: '🇵🇭', placeholder: '9XX XXX XXXX' },
    { name: 'Poland', code: '+48', flag: '🇵🇱', placeholder: 'XXX XXX XXX' },
    { name: 'Portugal', code: '+351', flag: '🇵🇹', placeholder: '9X XXX XXXX' },
    { name: 'Puerto Rico', code: '+1787', flag: '🇵🇷', placeholder: 'XXX XXXX' },
    { name: 'Qatar', code: '+974', flag: '🇶🇦', placeholder: 'XXXX XXXX' },
    { name: 'Reunion', code: '+262', flag: '🇷🇪', placeholder: 'XXX XX XX XX' },
    { name: 'Russia', code: '+7', flag: '🇷🇺', placeholder: '9XX XXX XX XX' },
    { name: 'Rwanda', code: '+250', flag: '🇷🇼', placeholder: '7XX XXX XXX' },
    { name: 'Saint Kitts and Nevis', code: '+1869', flag: '🇰🇳', placeholder: 'XXX XXXX' },
    { name: 'Saint Lucia', code: '+1758', flag: '🇱🇨', placeholder: 'XXX XXXX' },
    { name: 'Saint Vincent and the Grenadines', code: '+1784', flag: '🇻🇨', placeholder: 'XXX XXXX' },
    { name: 'Samoa', code: '+685', flag: '🇼🇸', placeholder: 'XX XXXX' },
    { name: 'San Marino', code: '+378', flag: '🇸🇲', placeholder: 'XXX XXX XXXX' },
    { name: 'Sao Tome and Principe', code: '+239', flag: '🇸🇹', placeholder: 'XXX XXXX' },
    { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦', placeholder: '5X XXX XXXX' },
    { name: 'Senegal', code: '+221', flag: '🇸🇳', placeholder: '7X XXX XX XX' },
    { name: 'Serbia', code: '+381', flag: '🇷🇸', placeholder: '6X XXX XXXX' },
    { name: 'Seychelles', code: '+248', flag: '🇸🇨', placeholder: 'X XX XX XX' },
    { name: 'Sierra Leone', code: '+232', flag: '🇸🇱', placeholder: 'XX XXX XXX' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬', placeholder: 'XXXX XXXX' },
    { name: 'Sint Maarten', code: '+1721', flag: '🇸🇽', placeholder: 'XXX XXXX' },
    { name: 'Slovakia', code: '+421', flag: '🇸🇰', placeholder: '9XX XXX XXX' },
    { name: 'Slovenia', code: '+386', flag: '🇸🇮', placeholder: 'XX XXX XXX' },
    { name: 'Solomon Islands', code: '+677', flag: '🇸🇧', placeholder: 'XX XXXXX' },
    { name: 'Somalia', code: '+252', flag: '🇸🇴', placeholder: 'XX XXX XXX' },
    { name: 'South Africa', code: '+27', flag: '🇿🇦', placeholder: '7X XXX XXXX' },
    { name: 'South Korea', code: '+82', flag: '🇰🇷', placeholder: '10 XXXX XXXX' },
    { name: 'South Sudan', code: '+211', flag: '🇸🇸', placeholder: '9X XXX XXXX' },
    { name: 'Spain', code: '+34', flag: '🇪🇸', placeholder: '6XX XXX XXX' },
    { name: 'Sri Lanka', code: '+94', flag: '🇱🇰', placeholder: '7X XXX XXXX' },
    { name: 'Sudan', code: '+249', flag: '🇸🇩', placeholder: '9X XXX XXXX' },
    { name: 'Suriname', code: '+597', flag: '🇸🇷', placeholder: 'XXX XXXX' },
    { name: 'Sweden', code: '+46', flag: '🇸🇪', placeholder: '7X XXX XX XX' },
    { name: 'Switzerland', code: '+41', flag: '🇨🇭', placeholder: '7X XXX XX XX' },
    { name: 'Syria', code: '+963', flag: '🇸🇾', placeholder: '9XX XXX XXX' },
    { name: 'Taiwan', code: '+886', flag: '🇹🇼', placeholder: '9XX XXX XXX' },
    { name: 'Tajikistan', code: '+992', flag: '🇹🇯', placeholder: 'XX XXX XXXX' },
    { name: 'Tanzania', code: '+255', flag: '🇹🇿', placeholder: '7XX XXX XXX' },
    { name: 'Thailand', code: '+66', flag: '🇹🇭', placeholder: '8X XXX XXXX' },
    { name: 'Togo', code: '+228', flag: '🇹🇬', placeholder: '9X XX XX XX' },
    { name: 'Tonga', code: '+676', flag: '🇹🇴', placeholder: 'XXX XXXX' },
    { name: 'Trinidad and Tobago', code: '+1868', flag: '🇹🇹', placeholder: 'XXX XXXX' },
    { name: 'Tunisia', code: '+216', flag: '🇹🇳', placeholder: 'XX XXX XXX' },
    { name: 'Turkey', code: '+90', flag: '🇹🇷', placeholder: '5XX XXX XXXX' },
    { name: 'Turkmenistan', code: '+993', flag: '🇹🇲', placeholder: '6X XXXXXX' },
    { name: 'Turks and Caicos Islands', code: '+1649', flag: '🇹🇨', placeholder: 'XXX XXXX' },
    { name: 'Tuvalu', code: '+688', flag: '🇹🇻', placeholder: 'XX XXXX' },
    { name: 'Uganda', code: '+256', flag: '🇺🇬', placeholder: '7XX XXX XXX' },
    { name: 'Ukraine', code: '+380', flag: '🇺🇦', placeholder: 'XX XXX XX XX' },
    { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪', placeholder: '5X XXX XXXX' },
    { name: 'United Kingdom', code: '+44', flag: '🇬🇧', placeholder: '7XXX XXXXXX' },
    { name: 'United States', code: '+1', flag: '🇺🇸', placeholder: 'XXX XXX XXXX' },
    { name: 'Uruguay', code: '+598', flag: '🇺🇾', placeholder: '9X XXX XXX' },
    { name: 'US Virgin Islands', code: '+1340', flag: '🇻🇮', placeholder: 'XXX XXXX' },
    { name: 'Uzbekistan', code: '+998', flag: '🇺🇿', placeholder: '9X XXX XX XX' },
    { name: 'Vanuatu', code: '+678', flag: '🇻🇺', placeholder: 'XX XXXXX' },
    { name: 'Vatican City', code: '+379', flag: '🇻🇦', placeholder: 'XXX XXX XXXX' },
    { name: 'Venezuela', code: '+58', flag: '🇻🇪', placeholder: '4XX XXX XXXX' },
    { name: 'Vietnam', code: '+84', flag: '🇻🇳', placeholder: '9X XXX XX XX' },
    { name: 'Wallis and Futuna', code: '+681', flag: '🇼🇫', placeholder: 'XX XX XX' },
    { name: 'Yemen', code: '+967', flag: '🇾🇪', placeholder: '7XX XXX XXX' },
    { name: 'Zambia', code: '+260', flag: '🇿🇲', placeholder: '9XX XXX XXX' },
    { name: 'Zimbabwe', code: '+263', flag: '🇿🇼', placeholder: '7X XXX XXXX' },
  ];
  selectedCountry = this.countries[0];
  countryDropdownOpen = false;
  countrySearch = '';
  processingPayment: boolean = false;

  // Tip modal
  showTipModal: boolean = false;
  tipOrderAmount: number = 0;
  selectedTipPercent: number = 0;
  customTipAmount: number = 0;
  pendingTipPaymentType: 'order' | 'guest' | 'orderpoint' | null = null;
  pendingTipPaymentId: string | null = null;
  pendingTipGuest: GuestOrders | null = null;

  // Team
  teamPendingRegistrations: PendingTeamRegistration[] = [];
  loadingTeam: boolean = false;
  approvedMembers: string[] = [];

  // Order categories collapse state (delivered collapsed by default)
  orderCategoryExpanded = {
    ready: true,
    inProgress: true,
    ordered: true,
    delivered: false
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Ensure activeView is menu at start
    this.activeView = 'menu';
    console.log('[Init] Starting, activeView:', this.activeView);

    // Always restore customer data from localStorage
    this.firstName = this.getCookie('customerFirstName') || '';
    this.lastName = this.getCookie('customerLastName') || '';
    const savedPhone = this.getCookie('customerPhone') || '';
    if (savedPhone) {
      const matched = this.countries.find(c => savedPhone.startsWith(c.code));
      if (matched) {
        this.selectedCountry = matched;
        this.customerPhone = savedPhone.substring(matched.code.length);
      } else {
        this.customerPhone = savedPhone;
      }
    }

    this.route.params.subscribe(params => {
      this.eventId = params['eventId'];
      this.orderPointId = params['orderPointId'];
      console.log('[Init] In route subscribe, activeView:', this.activeView);

      const existingRegistration = this.getCookie('registrationResponse');
      const storedEventId = this.getCookie('eventId');

      console.log('[Init] Route params:', { eventId: this.eventId, orderPointId: this.orderPointId });
      console.log('[Init] Cookies:', {
        hasRegistration: !!existingRegistration,
        storedEventId,
        eventIdMatch: storedEventId === this.eventId
      });

      // Use existing registration only if we have both the registration AND a matching eventId AND matching orderPointId
      const storedOrderPointId = this.getCookie('orderPointId');
      const orderPointMatches = storedOrderPointId === this.orderPointId;

      console.log('[Init] Stored orderPointId:', storedOrderPointId);
      console.log('[Init] Current orderPointId:', this.orderPointId);
      console.log('[Init] Order points match:', orderPointMatches);

      if (existingRegistration && storedEventId === this.eventId && orderPointMatches) {
        this.registrationResponse = JSON.parse(existingRegistration);
        console.log('[Init] Using existing registration:', this.registrationResponse?.id);

        // Fetch order point info to get menuId before loading menu
        if (this.orderPointId) {
          this.http.get<any>(`${environment.apiUrl}/api/register/order-points/${this.orderPointId}/info`)
            .subscribe({
              next: (orderPoint) => {
                this.orderPointMenuId = orderPoint.menuId || null;
                console.log('[Init] Order point info loaded, menuId:', this.orderPointMenuId);
                this.loadMenuItems();
              },
              error: () => {
                // Fall back to event menu if order point info fails
                this.loadMenuItems();
              }
            });
        } else {
          this.loadMenuItems();
        }

        // Re-check validation status from server (in case it was approved)
        this.http.get<any>(`${environment.apiUrl}/api/register/${this.registrationResponse.id}`)
          .subscribe({
            next: (registration) => {
              this.registrationResponse = registration;
              this.orderPointPayLater = registration.orderPointPayLater || false;
              this.setCookie('registrationResponse', JSON.stringify(registration), 7);
              console.log('[Init] Registration loaded, validationStatus:', registration.validationStatus, 'orderPointPayLater:', this.orderPointPayLater);

              if (registration.validationStatus === 'PENDING') {
                this.activeView = 'waiting';
                this.loadApprovedMembers();
                this.startValidationPolling();
              } else {
                this.activeView = 'menu';
                this.loadActiveOrders();
                this.loadOrders();
                // Connect WebSocket and load pending registrations for real-time badge updates
                if (this.orderPointPayLater && this.orderPointId) {
                  this.connectWebSocket();
                  this.loadTeamPendingRegistrations();
                }
              }
            },
            error: (err) => {
              console.error('Error checking registration status:', err);
              // Registration might not exist anymore, create new one
              this.clearAllCookies();
              this.checkOrderPointAndRegister();
            }
          });
      } else {
        // Different event, different order point, or no registration - clear and start fresh
        console.log('[Init] Creating new registration (no match or missing data)');
        this.clearAllCookies();
        this.checkOrderPointAndRegister();
      }

      this.loadAllergens();
      this.loadEventData();
      this.checkPaymentResult();
    });
  }

  private checkPaymentResult(): void {
    const paymentSuccess = localStorage.getItem('paymentSuccess');
    const paymentError = localStorage.getItem('paymentError');
    const confirmedOrderId = localStorage.getItem('confirmedOrderId');
    const tableOrderPayment = localStorage.getItem('tableOrderPayment');

    console.log('[Payment] Checking payment result:', {
      paymentSuccess,
      paymentError,
      confirmedOrderId,
      tableOrderPayment,
      hasRegistration: !!this.registrationResponse,
      registrationId: this.registrationResponse?.id
    });

    if (paymentSuccess) {
      localStorage.removeItem('paymentSuccess');
      localStorage.removeItem('tableOrderPayment');

      // Check if this was a table order payment
      if (tableOrderPayment === 'true') {
        console.log('[Payment] Table order payment processing, showing orders view');
        this.activeView = 'orders';
        this.showToast('Order placed! Payment is being processed.', 'success');
        this.loadOrders();
        return;
      }

      // Add the confirmed order to active orders and connect WebSocket
      if (confirmedOrderId) {
        console.log('[Payment] Adding order to active orders:', confirmedOrderId);
        localStorage.removeItem('confirmedOrderId');
        this.activeOrderIds.add(confirmedOrderId);
        this.saveActiveOrders();
        this.connectWebSocket();
        this.showToast('Order placed! Payment is being processed.', 'success');
      }
    } else if (paymentError) {
      localStorage.removeItem('paymentError');
      localStorage.removeItem('confirmedOrderId');
      localStorage.removeItem('tableOrderPayment');
      this.showToast('There was an issue processing your order. Please try again.', 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showingToast = true;
    setTimeout(() => {
      this.showingToast = false;
    }, 4000);
  }

  private clearAllCookies(): void {
    this.deleteCookie('registrationResponse');
    this.deleteCookie('orderPointId');
    this.deleteCookie('activeOrders');
    this.deleteCookie('eventId');
    this.activeOrderIds.clear();
    this.disconnectWebSocket();
  }

  loadEventData(): void {
    this.http.get<EventData>(`${environment.apiUrl}/api/events/${this.eventId}`)
      .subscribe({
        next: (event) => {
          this.eventData = event;
        },
        error: (err) => {
          console.error('Error loading event data:', err);
        }
      });
  }

  getLogoUrl(logoPath: string): string {
    return `${environment.apiUrl}/api/images/${logoPath}`;
  }

  getItemImageUrl(imagePath: string): string {
    return `${environment.apiUrl}/api/images/${imagePath}`;
  }

  ngOnDestroy(): void {
    this.disconnectWebSocket();
    this.stopValidationPolling();
    this.removeWakeUpListeners();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private setupWakeUpListeners(): void {
    // Listen for visibility changes (device wake up / tab focus)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WebSocket] Page became visible, checking connection...');
        this.reconnectIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Listen for online events (network reconnection)
    this.onlineHandler = () => {
      console.log('[WebSocket] Device came online, reconnecting...');
      this.reconnectIfNeeded();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private removeWakeUpListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private reconnectIfNeeded(): void {
    const needsConnection = this.activeOrderIds.size > 0 ||
                           this.activeView === 'team' ||
                           (this.activeView === 'orders' && this.orderPointPayLater);
    if (needsConnection) {
      // Force disconnect and reconnect to ensure fresh connection
      if (this.stompClient) {
        console.log('[WebSocket] Forcing reconnection...');
        this.stompClient.deactivate();
        this.stompClient = null;
        this.connected = false;
      }
      // Small delay before reconnecting
      setTimeout(() => {
        this.connectWebSocket();
      }, 500);
    }
  }

  private stopValidationPolling(): void {
    if (this.validationPollInterval) {
      clearInterval(this.validationPollInterval);
      this.validationPollInterval = null;
    }
  }

  private startValidationPolling(): void {
    this.stopValidationPolling();
    this.validationPollInterval = setInterval(() => {
      this.checkValidationStatus();
    }, 3000); // Poll every 3 seconds
  }

  private checkValidationStatus(): void {
    if (!this.registrationResponse?.id) return;

    this.http.get<any>(`${environment.apiUrl}/api/register/${this.registrationResponse.id}`)
      .subscribe({
        next: (registration) => {
          if (registration.validationStatus === 'APPROVED') {
            this.stopValidationPolling();
            this.registrationResponse = registration;
            this.orderPointPayLater = registration.orderPointPayLater || false;
            this.setCookie('registrationResponse', JSON.stringify(registration), 7);
            this.activeView = 'menu';
            this.loadOrders();
            // Connect WebSocket and load pending registrations for real-time badge updates
            if (this.orderPointPayLater && this.orderPointId) {
              this.connectWebSocket();
              this.loadTeamPendingRegistrations();
            }
          }
        },
        error: (err) => {
          console.error('Error checking validation status:', err);
        }
      });
  }

  // Navigation
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  navigateTo(view: 'menu' | 'orders' | 'team' | 'login' | 'payments'): void {
    console.log('[Nav] navigateTo called with:', view, 'stack:', new Error().stack);
    this.activeView = view;
    this.closeMenu();
    if (view === 'orders') {
      this.loadOrders();
      // Ensure WebSocket is connected for real-time table order updates
      if (this.orderPointPayLater) {
        this.connectWebSocket();
      }
    } else if (view === 'team') {
      this.loadTeamPendingRegistrations();
      // Ensure WebSocket is connected for real-time updates
      this.connectWebSocket();
    }
  }

  checkOrderPointAndRegister(): void {
    console.log('[CheckOP] Starting, orderPointId:', this.orderPointId);
    if (!this.orderPointId) {
      console.log('[CheckOP] No orderPointId, registering directly');
      this.registerToEvent();
      return;
    }

    this.loading = true;
    console.log('[CheckOP] Fetching order point info...');
    this.http.get<any>(`${environment.apiUrl}/api/register/order-points/${this.orderPointId}/info`)
      .subscribe({
        next: (orderPoint) => {
          console.log('[CheckOP] Order point info received:', orderPoint);
          this.orderPointPayLater = orderPoint.payLater;
          this.orderPointMenuId = orderPoint.menuId || null;
          this.loading = false;

          // Load menu items now that we have the order point info
          this.loadMenuItems();

          if (orderPoint.payLater) {
            // Prefill from saved customer data
            this.firstName = this.getCookie('customerFirstName') || '';
            this.lastName = this.getCookie('customerLastName') || '';
            const savedPhone = this.getCookie('customerPhone') || '';
            if (savedPhone) {
              // Find matching country by prefix
              const matched = this.countries.find(c => savedPhone.startsWith(c.code));
              if (matched) {
                this.selectedCountry = matched;
                this.customerPhone = savedPhone.substring(matched.code.length);
              } else {
                this.customerPhone = savedPhone;
              }
            }
            console.log('[CheckOP] payLater=true, showing nickname view');
            this.activeView = 'nickname';
          } else {
            // Register immediately
            console.log('[CheckOP] payLater=false, registering directly');
            this.registerToEvent();
          }
          console.log('[CheckOP] activeView is now:', this.activeView);
        },
        error: (err) => {
          console.error('[CheckOP] Error fetching order point info:', err);
          // Fall back to normal registration
          this.loading = false;
          this.registerToEvent();
        }
      });
  }

  toggleCountryDropdown(): void {
    this.countryDropdownOpen = !this.countryDropdownOpen;
    this.countrySearch = '';
  }

  closeCountryDropdown(): void {
    this.countryDropdownOpen = false;
    this.countrySearch = '';
  }

  selectCountry(country: any): void {
    this.selectedCountry = country;
    this.customerPhone = '';
    this.countryDropdownOpen = false;
    this.countrySearch = '';
  }

  get filteredCountries(): any[] {
    if (!this.countrySearch.trim()) return this.countries;
    const search = this.countrySearch.toLowerCase();
    return this.countries.filter(c =>
      c.name.toLowerCase().includes(search) || c.code.includes(search)
    );
  }

  onCountryChange(): void {
    this.customerPhone = '';
  }

  getFullPhoneNumber(): string {
    const phone = this.customerPhone.trim();
    if (!phone) return '';
    return this.selectedCountry.code + phone;
  }

  submitNickname(): void {
    // Build nickname from first + last name
    this.nickname = [this.firstName.trim(), this.lastName.trim()].filter(Boolean).join(' ');

    // Save customer data for future visits
    if (this.firstName.trim()) {
      this.setCookie('customerFirstName', this.firstName.trim(), 365);
    }
    if (this.lastName.trim()) {
      this.setCookie('customerLastName', this.lastName.trim(), 365);
    }
    const fullPhone = this.getFullPhoneNumber();
    if (fullPhone) {
      this.setCookie('customerPhone', fullPhone, 365);
    }
    this.registerToEvent();
  }

  registerToEvent(): void {
    this.loading = true;
    this.error = '';

    let url = `${environment.apiUrl}/api/register/events/${this.eventId}`;
    const params: string[] = [];

    if (this.orderPointId) {
      params.push(`orderPointId=${this.orderPointId}`);
    }
    if (this.nickname && this.nickname.trim()) {
      params.push(`nickname=${encodeURIComponent(this.nickname.trim())}`);
    }
    if (this.firstName && this.firstName.trim()) {
      params.push(`firstName=${encodeURIComponent(this.firstName.trim())}`);
    }
    if (this.lastName && this.lastName.trim()) {
      params.push(`lastName=${encodeURIComponent(this.lastName.trim())}`);
    }
    const fullPhone = this.getFullPhoneNumber();
    if (fullPhone) {
      params.push(`phone=${encodeURIComponent(fullPhone)}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    console.log('[Register] Creating registration with URL:', url);
    console.log('[Register] Nickname being sent:', this.nickname);
    this.http.post<any>(url, {})
      .subscribe({
        next: (response) => {
          console.log('[Register] Response:', response);
          console.log('[Register] validationStatus:', response.validationStatus);
          this.registrationResponse = response;
          this.orderPointPayLater = response.orderPointPayLater || false;
          this.setCookie('registrationResponse', JSON.stringify(response), 7);
          this.setCookie('orderPointId', this.orderPointId, 7);
          this.setCookie('eventId', this.eventId, 7);
          this.loading = false;

          // Check if validation is pending
          if (response.validationStatus === 'PENDING') {
            console.log('[Register] Status is PENDING, showing waiting view');
            this.activeView = 'waiting';
            this.loadApprovedMembers();
            this.startValidationPolling();
          } else {
            console.log('[Register] Status is not PENDING, showing menu');
            this.activeView = 'menu';
            this.loadOrders();
            // Connect WebSocket and load pending registrations for real-time badge updates
            if (this.orderPointPayLater && this.orderPointId) {
              this.connectWebSocket();
              this.loadTeamPendingRegistrations();
            }
          }
        },
        error: (err) => {
          this.error = 'Failed to register: ' + (err.message || 'Unknown error');
          this.loading = false;
        }
      });
  }

  // Menu methods
  loadMenuItems(): void {
    this.loadingMenu = true;

    // If order point has a specific menu assigned, try to load that menu first
    if (this.orderPointMenuId) {
      const menuUrl = `${environment.apiUrl}/api/menu/menus/${this.orderPointMenuId}/tree`;
      console.log('[Menu] Loading menu by menuId:', this.orderPointMenuId);

      this.http.get<MenuItem[]>(menuUrl)
        .subscribe({
          next: (items) => {
            if (items && items.length > 0) {
              console.log('[Menu] Loaded menu items by menuId:', items.length);
              this.menuItems = items;
              this.loadingMenu = false;
            } else {
              // Menu exists but has no items, fall back to event menu
              console.log('[Menu] Menu by menuId is empty, falling back to event menu');
              this.loadEventMenu();
            }
          },
          error: (err) => {
            console.error('[Menu] Error loading menu by menuId, falling back to event menu:', err);
            this.loadEventMenu();
          }
        });
    } else {
      // No specific menu assigned, load event's default menu
      this.loadEventMenu();
    }
  }

  private loadEventMenu(): void {
    const eventMenuUrl = `${environment.apiUrl}/api/events/${this.eventId}/menu`;
    console.log('[Menu] Loading event menu');

    this.http.get<MenuItem[]>(eventMenuUrl)
      .subscribe({
        next: (items) => {
          console.log('[Menu] Loaded event menu items:', items.length);
          this.menuItems = items;
          this.loadingMenu = false;
        },
        error: (err) => {
          console.error('[Menu] Error loading event menu:', err);
          this.loadingMenu = false;
        }
      });
  }

  loadAllergens(): void {
    this.http.get<Allergen[]>(`${environment.apiUrl}/api/allergens/active`)
      .subscribe({
        next: (allergens) => {
          this.allergens = allergens;
        },
        error: (err) => {
          console.error('Error loading allergens:', err);
        }
      });
  }

  getAllergenNames(allergenIds: string[]): string {
    if (!allergenIds?.length) return '';
    return allergenIds
      .map(id => this.allergens.find(a => a.id === id))
      .filter(a => a)
      .map(a => a!.name)
      .join(', ');
  }

  getQuantity(itemId: string): number {
    return this.quantities.get(itemId) || 0;
  }

  increaseQuantity(item: MenuItem): void {
    const current = this.getQuantity(item.id);
    this.quantities.set(item.id, current + 1);
  }

  decreaseQuantity(item: MenuItem): void {
    const current = this.getQuantity(item.id);
    if (current > 0) {
      this.quantities.set(item.id, current - 1);
    }
  }

  getSelectedItems(): OrderItem[] {
    const items: OrderItem[] = [];
    this.collectSelectedItems(this.menuItems, items);
    return items;
  }

  private collectSelectedItems(menuItems: MenuItem[], result: OrderItem[]): void {
    for (const item of menuItems) {
      if (item.orderable) {
        const qty = this.getQuantity(item.id);
        if (qty > 0) {
          result.push({ menuItem: item, quantity: qty });
        }
      }
      if (item.children && item.children.length > 0) {
        this.collectSelectedItems(item.children, result);
      }
    }
  }

  getTotalItems(): number {
    return this.getSelectedItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.getSelectedItems().reduce((sum, item) => {
      return sum + (item.menuItem.price || 0) * item.quantity;
    }, 0);
  }

  goToCheckout(): void {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) {
      this.orderStatus = 'Please select at least one item';
      return;
    }
    this.orderStatus = '';
    this.activeView = 'checkout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToMenu(): void {
    this.activeView = 'menu';
  }

  placeOrder(): void {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) {
      this.orderStatus = 'Please select at least one item';
      return;
    }

    // Check if pay later is enabled for this order point
    if (this.registrationResponse?.orderPointPayLater) {
      this.showPaymentChoice = true;
      return;
    }

    // Otherwise proceed with normal payment flow
    this.submitOrder(false);
  }

  closePaymentChoice(): void {
    this.showPaymentChoice = false;
  }

  submitOrder(payLater: boolean): void {
    this.showPaymentChoice = false;

    const selectedItems = this.getSelectedItems();
    const registrationResponse = this.getCookie('registrationResponse');
    const orderPointId = this.getCookie('orderPointId');

    if (!registrationResponse || !orderPointId) {
      this.orderStatus = 'Error: Missing registration data';
      return;
    }

    const registration = JSON.parse(registrationResponse);
    const orderItems = selectedItems.map(item => ({
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      price: item.menuItem.price || 0,
      quantity: item.quantity
    }));

    const orderRequest = {
      registrationId: registration.id,
      orderPointId: orderPointId,
      payLater: payLater,
      orderItems: orderItems
    };

    console.log('[Order] Creating order with registrationId:', registration.id, 'payLater:', payLater);

    this.placingOrder = true;
    this.orderStatus = '';

    // First create the order
    this.http.post<any>(`${environment.apiUrl}/api/orders`, orderRequest)
      .subscribe({
        next: (orderResponse) => {
          if (payLater) {
            // Pay later: order is already ACTIVE with needsPayment flag
            // Clear cart and show success
            this.quantities.clear();
            this.placingOrder = false;
            this.activeView = 'menu';

            // Add to active orders for notifications
            this.activeOrderIds.add(orderResponse.id);
            this.saveActiveOrders();
            this.connectWebSocket();

            this.showToast('Order placed! Pay at the counter.', 'success');
            this.loadOrders();
          } else {
            // Pay now: proceed with payment
            this.setCookie('pendingOrderId', orderResponse.id, 1);
            this.setCookie('paymentEventId', this.eventId, 1);
            this.setCookie('paymentOrderPointId', this.orderPointId, 1);

            const totalAmount = this.getTotalPrice();

            // Start payment with Netopia
            const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&orderId=${orderResponse.id}`;
            this.http.post<any>(`${environment.apiUrl}/api/payments/orders/${orderResponse.id}/start`, { returnUrl, firstName: this.firstName, lastName: this.lastName, phone: this.getFullPhoneNumber() }).subscribe({
              next: (paymentResponse) => {
                this.quantities.clear();

                if (paymentResponse.payment?.paymentURL) {
                  window.location.href = paymentResponse.payment.paymentURL;
                } else {
                  this.orderStatus = 'Payment URL not received';
                  this.placingOrder = false;
                }
              },
              error: (err) => {
                console.error('Payment error:', err);
                this.orderStatus = 'Failed to start payment: ' + (err.error?.message || err.message || 'Unknown error');
                this.placingOrder = false;
              }
            });
          }
        },
        error: (err) => {
          this.orderStatus = 'Failed to create order: ' + (err.message || 'Unknown error');
          this.placingOrder = false;
        }
      });
  }

  // Orders methods
  loadOrders(): void {
    if (!this.registrationResponse?.id) return;

    this.loadingOrders = true;
    this.http.get<ApiOrder[]>(`${environment.apiUrl}/api/orders/registrations/${this.registrationResponse.id}`)
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loadingOrders = false;
        },
        error: (err) => {
          console.error('Error loading orders:', err);
          this.loadingOrders = false;
        }
      });

    // For payLater order points, also load all orders at the order point
    console.log('[Orders] orderPointPayLater:', this.orderPointPayLater, 'orderPointId:', this.orderPointId);
    if (this.orderPointPayLater && this.orderPointId) {
      this.loadOrderPointOrders();
    }
  }

  loadOrderPointOrders(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    console.log('[Orders] Loading order point orders for:', this.orderPointId);
    this.http.get<ApiOrder[]>(`${environment.apiUrl}/api/orders/order-points/${this.orderPointId}?registrationId=${this.registrationResponse.id}`)
      .subscribe({
        next: (orders) => {
          console.log('[Orders] Loaded order point orders:', orders.length);
          this.orderPointOrders = orders;
        },
        error: (err) => {
          console.error('Error loading order point orders:', err);
        }
      });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return '#2196F3';
      case 'IN_PROGRESS': return '#FF9800';
      case 'READY': return '#4CAF50';
      case 'DELIVERED': return '#4CAF50';
      case 'CANCELLED': return '#f44336';
      default: return '#757575';
    }
  }

  getInProgressOrdersCount(): number {
    return this.orders.filter(order =>
      order.status === 'ACTIVE' || order.status === 'IN_PROGRESS' || order.status === 'READY'
    ).length;
  }

  getFirstInProgressOrderColor(): string {
    const inProgressOrders = this.orders.filter(order =>
      order.status === 'ACTIVE' || order.status === 'IN_PROGRESS' || order.status === 'READY'
    );
    if (inProgressOrders.length === 0) return '#757575';

    // Find the oldest order (lowest orderNo = first created)
    const oldestOrder = inProgressOrders.reduce((oldest, current) =>
      current.orderNo < oldest.orderNo ? current : oldest
    );
    return this.getStatusColor(oldestOrder.status);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Pending';
      case 'IN_PROGRESS': return 'In Progress';
      case 'READY': return 'Ready';
      case 'DELIVERED': return 'Delivered';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  getItemStatusLabel(status: string): string {
    switch (status) {
      case 'ORDERED': return 'Ordered';
      case 'IN_PROGRESS': return 'Preparing';
      case 'DONE': return 'Ready';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  getOrderTotal(order: ApiOrder): number {
    return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getOrdersByStatus(status: string): ApiOrder[] {
    return this.orders.filter(order => order.status === status);
  }

  // Orders by status for the new Orders view
  getOrderedOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'ACTIVE');
  }

  getInProgressOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'IN_PROGRESS');
  }

  getReadyOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'READY');
  }

  getDeliveredOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'DELIVERED');
  }

  toggleOrderCategory(category: 'ready' | 'inProgress' | 'ordered' | 'delivered'): void {
    this.orderCategoryExpanded[category] = !this.orderCategoryExpanded[category];
  }

  // Order point orders methods (for payLater)
  setOrdersGroupMode(mode: 'table' | 'guest'): void {
    this.ordersGroupMode = mode;
  }

  setOrdersViewMode(mode: 'total' | 'order'): void {
    this.ordersViewMode = mode;
  }

  getOrderPointOrdersTotal(): number {
    return this.orderPointOrders.reduce((total, order) => total + this.getOrderTotal(order), 0);
  }

  getAggregatedOrderItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number }[] {
    const itemMap = new Map<string, { quantity: number; totalPrice: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.price * item.quantity;
        } else {
          itemMap.set(item.name, {
            quantity: item.quantity,
            totalPrice: item.price * item.quantity
          });
        }
      }
    }

    return Array.from(itemMap.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      totalPrice: data.totalPrice
    }));
  }

  // Aggregates only active (non-paid, non-cancelled) items for total view
  getAggregatedActiveItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number }[] {
    const itemMap = new Map<string, { quantity: number; totalPrice: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        // Only include non-paid, non-cancelled items
        if (item.paid || item.status === 'CANCELLED') {
          continue;
        }
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.price * item.quantity;
        } else {
          itemMap.set(item.name, {
            quantity: item.quantity,
            totalPrice: item.price * item.quantity
          });
        }
      }
    }

    return Array.from(itemMap.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      totalPrice: data.totalPrice
    }));
  }

  getOrderPointOrdersByGuest(): GuestOrders[] {
    const groups = new Map<string, { nickname: string; registrationId: string; orders: ApiOrder[] }>();

    for (const order of this.orderPointOrders) {
      const registrationId = order.registrationId || 'unknown';
      if (!groups.has(registrationId)) {
        groups.set(registrationId, {
          nickname: order.nickname || 'Unknown',
          registrationId: registrationId,
          orders: []
        });
      }
      groups.get(registrationId)!.orders.push(order);
    }

    return Array.from(groups.values()).map(group => ({
      nickname: group.nickname,
      registrationId: group.registrationId,
      orders: group.orders,
      total: group.orders.reduce((sum, o) => sum + this.getOrderTotal(o), 0)
    }));
  }

  // Payment methods for order point orders
  getOrderUnpaidTotal(order: ApiOrder): number {
    return order.items
      .filter(item => !item.paid && item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  hasUnpaidItems(order: ApiOrder): boolean {
    return order.items.some(item => !item.paid && item.status !== 'CANCELLED');
  }

  getActiveItems(order: ApiOrder): ApiOrderItem[] {
    return order.items.filter(item => !item.paid && item.status !== 'CANCELLED');
  }

  getOrdersWithUnpaidItems(): ApiOrder[] {
    return this.orderPointOrders.filter(o => this.hasUnpaidItems(o));
  }

  getUnpaidOrderPointTotal(): number {
    return this.orderPointOrders.reduce((sum, o) => sum + this.getOrderUnpaidTotal(o), 0);
  }

  getGuestOrdersWithUnpaidItems(guest: GuestOrders): ApiOrder[] {
    return guest.orders.filter(o => this.hasUnpaidItems(o));
  }

  getGuestUnpaidTotal(guest: GuestOrders): number {
    return guest.orders.reduce((sum, o) => sum + this.getOrderUnpaidTotal(o), 0);
  }

  hasAnyUnpaidItems(): boolean {
    return this.orderPointOrders.some(o => this.hasUnpaidItems(o));
  }

  guestHasUnpaidItems(guest: GuestOrders): boolean {
    return guest.orders.some(o => this.hasUnpaidItems(o));
  }

  payOrder(order: ApiOrder): void {
    if (this.processingPayment) return;

    // Show tip modal first
    this.tipOrderAmount = this.getOrderUnpaidTotal(order);
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'order';
    this.pendingTipPaymentId = order.id;
    this.pendingTipGuest = null;
    this.showTipModal = true;
  }

  private executeOrderPayment(orderId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=order`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/orders/${orderId}/start`, { returnUrl, tip, firstName: this.firstName, lastName: this.lastName, phone: this.getFullPhoneNumber() }).subscribe({
      next: (paymentResponse) => {
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  payAllOrders(): void {
    if (this.processingPayment) return;
    if (!this.hasAnyUnpaidItems()) return;

    // Show tip modal first
    this.tipOrderAmount = this.getUnpaidOrderPointTotal();
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'orderpoint';
    this.pendingTipPaymentId = this.orderPointId;
    this.pendingTipGuest = null;
    this.showTipModal = true;
  }

  private executeOrderPointPayment(orderPointId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=orderpoint`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/order-points/${orderPointId}/start`, { returnUrl, tip, firstName: this.firstName, lastName: this.lastName, phone: this.getFullPhoneNumber() }).subscribe({
      next: (paymentResponse) => {
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  payGuestOrders(guest: GuestOrders): void {
    if (this.processingPayment) return;
    if (!this.guestHasUnpaidItems(guest)) return;

    // Show tip modal first
    this.tipOrderAmount = this.getGuestUnpaidTotal(guest);
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'guest';
    this.pendingTipPaymentId = guest.registrationId;
    this.pendingTipGuest = guest;
    this.showTipModal = true;
  }

  private executeGuestPayment(registrationId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=guest`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/registrations/${registrationId}/start`, { returnUrl, tip, firstName: this.firstName, lastName: this.lastName, phone: this.getFullPhoneNumber() }).subscribe({
      next: (paymentResponse) => {
        console.log('[Payment] Guest payment response:', paymentResponse);
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          console.log('[Payment] Storing reference:', paymentResponse.reference);
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          console.log('[Payment] Stored pendingPaymentReference:', localStorage.getItem('pendingPaymentReference'));
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  // Tip modal methods
  selectTipPercent(percent: number): void {
    this.selectedTipPercent = percent;
    if (percent !== -1) {
      this.customTipAmount = 0;
    }
  }

  getTipAmount(): number {
    if (this.selectedTipPercent === -1) {
      return this.customTipAmount || 0;
    }
    return (this.tipOrderAmount * this.selectedTipPercent) / 100;
  }

  getTipTotal(): number {
    return this.tipOrderAmount + this.getTipAmount();
  }

  isTipValid(): boolean {
    if (this.selectedTipPercent === -1) {
      return this.customTipAmount >= 0;
    }
    return true;
  }

  closeTipModal(): void {
    this.showTipModal = false;
    this.pendingTipPaymentType = null;
    this.pendingTipPaymentId = null;
    this.pendingTipGuest = null;
  }

  confirmTipAndPay(): void {
    if (!this.isTipValid()) return;

    const tip = this.getTipAmount();
    // Keep modal open and show processing state until redirect
    this.processingPayment = true;

    switch (this.pendingTipPaymentType) {
      case 'order':
        if (this.pendingTipPaymentId) {
          this.executeOrderPayment(this.pendingTipPaymentId, tip);
        }
        break;
      case 'guest':
        if (this.pendingTipPaymentId) {
          this.executeGuestPayment(this.pendingTipPaymentId, tip);
        }
        break;
      case 'orderpoint':
        if (this.pendingTipPaymentId) {
          this.executeOrderPointPayment(this.pendingTipPaymentId, tip);
        }
        break;
    }
    // Don't close modal - page will redirect to Netopia
  }

  // Team methods
  loadTeamPendingRegistrations(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    this.loadingTeam = true;
    this.http.get<PendingTeamRegistration[]>(
      `${environment.apiUrl}/api/register/order-points/${this.orderPointId}/pending?excludeRegistrationId=${this.registrationResponse.id}`
    ).subscribe({
      next: (registrations) => {
        this.teamPendingRegistrations = registrations;
        this.loadingTeam = false;
      },
      error: (err) => {
        console.error('Error loading team pending registrations:', err);
        this.loadingTeam = false;
      }
    });
  }

  loadApprovedMembers(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    this.http.get<any[]>(
      `${environment.apiUrl}/api/register/order-points/${this.orderPointId}/approved?excludeRegistrationId=${this.registrationResponse.id}`
    ).subscribe({
      next: (registrations) => {
        this.approvedMembers = registrations
          .map(r => r.nickname)
          .filter((name: string | null) => name && name.trim() !== '');
      },
      error: (err) => {
        console.error('Error loading approved members:', err);
      }
    });
  }

  approveTeamRegistration(registrationId: string): void {
    if (!this.registrationResponse?.id) return;

    this.http.post<PendingTeamRegistration>(
      `${environment.apiUrl}/api/register/${registrationId}/approve-by-client?approverRegistrationId=${this.registrationResponse.id}`,
      {}
    ).subscribe({
      next: () => {
        this.showToast('Registration approved!', 'success');
        this.loadTeamPendingRegistrations();
      },
      error: (err) => {
        console.error('Error approving registration:', err);
        this.showToast('Failed to approve registration', 'error');
      }
    });
  }

  // Login methods
  loginWithFacebook(): void {
    console.log('Login with Facebook clicked');
    // TODO: Implement Facebook OAuth login
    this.showToast('Facebook login coming soon', 'success');
  }

  loginWithGoogle(): void {
    console.log('Login with Google clicked');
    // TODO: Implement Google OAuth login
    this.showToast('Google login coming soon', 'success');
  }

  // Storage methods (using localStorage instead of cookies for better iOS support)
  getCookie(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  }

  setCookie(name: string, value: string, days: number): void {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  deleteCookie(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  }

  // WebSocket methods
  private loadActiveOrders(): void {
    const activeOrdersJson = this.getCookie('activeOrders');
    console.log('[Init] Loading active orders from cookie:', activeOrdersJson);
    if (activeOrdersJson) {
      const orderIds = JSON.parse(activeOrdersJson) as string[];
      orderIds.forEach(id => this.activeOrderIds.add(id));
      console.log('[Init] Active order IDs loaded:', orderIds);
      if (this.activeOrderIds.size > 0) {
        this.connectWebSocket();
      }
    }
  }

  private saveActiveOrders(): void {
    const orderIds = Array.from(this.activeOrderIds);
    if (orderIds.length > 0) {
      this.setCookie('activeOrders', JSON.stringify(orderIds), 7);
    } else {
      this.deleteCookie('activeOrders');
    }
  }

  private connectWebSocket(): void {
    if (this.stompClient?.active) {
      console.log('[WebSocket] Already connected');
      return;
    }
    if (!this.registrationResponse?.id) {
      console.log('[WebSocket] No registration ID, cannot connect');
      return;
    }

    const registrationId = this.registrationResponse.id;
    console.log('[WebSocket] Connecting for registration:', registrationId);

    // Setup wake-up listeners if not already done
    if (!this.visibilityHandler) {
      this.setupWakeUpListeners();
    }

    this.stompClient = new Client({
      webSocketFactory: () => new (SockJS as any)(`${environment.apiUrl}/ws`),
      // Heartbeat: send every 10s, expect every 10s
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Auto reconnect with increasing delay (1s, 2s, 4s... max 30s)
      reconnectDelay: 2000,
      onConnect: () => {
        this.connected = true;
        console.log('[WebSocket] Connected, subscribing to /topic/registration/' + registrationId);
        this.stompClient?.subscribe(`/topic/registration/${registrationId}`, (message) => {
          console.log('[WebSocket] Received message:', message.body);
          const notification = JSON.parse(message.body) as OrderNotification;
          this.handleNotification(notification);
        });

        // Subscribe to order point registration updates (for team page)
        if (this.orderPointId) {
          console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/registrations');
          this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/registrations`, (message) => {
            console.log('[WebSocket] Received registration update:', message.body);
            const data = JSON.parse(message.body);
            if (data.type === 'REGISTRATION_APPROVED') {
              // Remove the approved registration from the team pending list
              this.teamPendingRegistrations = this.teamPendingRegistrations.filter(r => r.id !== data.registrationId);
            }
          });

          // Subscribe to validation requests (when someone new needs approval)
          console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/validation-requests');
          this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/validation-requests`, (message) => {
            console.log('[WebSocket] Received validation request:', message.body);
            const data = JSON.parse(message.body);
            if (data.type === 'VALIDATION_REQUESTED' && data.registrationId !== this.registrationResponse?.id) {
              // Add the new pending registration to the list (use spread to trigger change detection)
              const newRegistration: PendingTeamRegistration = {
                id: data.registrationId,
                orderPointId: data.orderPointId || this.orderPointId,
                orderPointName: data.orderPointName || '',
                validationStatus: 'PENDING',
                createdAt: new Date().toISOString(),
                nickname: data.nickname
              };
              // Check if not already in the list
              if (!this.teamPendingRegistrations.find(r => r.id === data.registrationId)) {
                this.teamPendingRegistrations = [...this.teamPendingRegistrations, newRegistration];
              }
            }
          });

          // Subscribe to order updates for real-time table orders (order point specific)
          if (this.orderPointPayLater) {
            console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/orders for table order updates');
            this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/orders`, (message) => {
              console.log('[WebSocket] Received order point order update:', message.body);
              // Reload order point orders when any order update is received
              this.loadOrderPointOrders();
            });

            // Also subscribe to payment updates for this order point
            console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/payments for payment updates');
            this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/payments`, (message) => {
              console.log('[WebSocket] Received payment update:', message.body);
              // Reload order point orders when payment status changes
              this.loadOrderPointOrders();
            });
          }
        }
      },
      onStompError: (error) => {
        console.error('[WebSocket] STOMP error:', error);
        this.connected = false;
      },
      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
      },
      onWebSocketClose: () => {
        console.log('[WebSocket] Connection closed');
        this.connected = false;
      }
    });

    this.stompClient.activate();
  }

  private disconnectWebSocket(): void {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
  }

  private handleNotification(notification: OrderNotification): void {
    this.notifications.unshift(notification);
    this.playBeep();

    // Auto-dismiss: 2s if on orders view, 5s otherwise
    const dismissTime = this.activeView === 'orders' ? 2000 : 5000;
    setTimeout(() => {
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, dismissTime);

    // Always refresh orders to update badge color
    this.loadOrders();

    if (notification.orderClosed) {
      this.activeOrderIds.delete(notification.orderId);
      this.saveActiveOrders();

      if (this.activeOrderIds.size === 0) {
        this.disconnectWebSocket();
      }
    }
  }

  onNotificationClick(notification: OrderNotification, index: number): void {
    this.notifications.splice(index, 1);
    if (this.activeView !== 'orders') {
      this.navigateTo('orders');
    }
  }

  private playBeep(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {
      console.error('Could not play beep:', e);
    }
  }

  dismissNotification(index: number): void {
    this.notifications.splice(index, 1);
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'ORDER_TAKEN':
      case 'ITEM_STARTED':
        return '#FF9800';
      case 'ITEM_READY':
        return '#4CAF50';
      case 'ORDER_READY':
        return '#2196F3';
      case 'ORDER_DELIVERED':
        return '#9C27B0';
      case 'ORDER_CANCELLED':
      case 'ITEM_CANCELLED':
        return '#f44336';
      default:
        return '#757575';
    }
  }

  scrollToSection(sectionId: string): void {
    this.categoryNavExpanded = false;
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 140;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  }

  toggleCategoryNav(): void {
    this.categoryNavExpanded = !this.categoryNavExpanded;
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
}