// Mock data for the application
import type { User, Order, Address, Profile, ChatMessage } from './types'

export const INSURANCE_PROVIDERS = [
  'Jubilee Health Insurance Uganda',
  'AAR Healthcare Uganda',
  'UAP Old Mutual Insurance',
  'ICEA LION Group',
  'Britam Insurance Uganda',
  'IAA Healthcare (MicroEnsure)',
  'CIC Insurance Group',
  'APA Insurance Uganda',
  'Prudential Uganda',
  'Liberty Health (Uganda)',
  'Cigna Global',
  'Other',
]

// Mock user data
export const mockUser: User = {
  id: 'user-1',
  email: 'john.doe@example.com',
  phone: '+256700123456',
  profiles: [
    {
      id: 'profile-1',
      name: 'John Doe',
      dateOfBirth: '1985-06-15',
      relationship: 'Self',
      isMainAccount: true,
      insurance: {
        provider: 'AAR Healthcare',
        policyNumber: 'AAR-2024-12345',
        policyHolderName: 'John Doe',
        expiryDate: '2026-12-31',
        status: 'verified',
      },
    },
    {
      id: 'profile-2',
      name: 'Jane Doe',
      dateOfBirth: '1987-03-20',
      relationship: 'Spouse',
      isMainAccount: false,
      insurance: {
        provider: 'AAR Healthcare',
        policyNumber: 'AAR-2024-12345',
        policyHolderName: 'John Doe',
        expiryDate: '2026-12-31',
        status: 'verified',
      },
    },
    {
      id: 'profile-3',
      name: 'Emma Doe',
      dateOfBirth: '2015-09-10',
      relationship: 'Daughter',
      isMainAccount: false,
      insurance: {
        provider: 'AAR Healthcare',
        policyNumber: 'AAR-2024-12345',
        policyHolderName: 'John Doe',
        expiryDate: '2026-12-31',
        status: 'verified',
      },
    },
    {
      id: 'profile-4',
      name: 'James Doe',
      dateOfBirth: '2018-01-25',
      relationship: 'Son',
      isMainAccount: false,
    },
  ],
}

// Mock orders
export const mockOrders: Order[] = [
  {
    id: 'order-1',
    profileId: 'profile-1',
    profileName: 'John Doe',
    profileInsurance: 'verified',
    prescriptionUrl: 'https://example.com/prescription-1.jpg',
    status: 'out-for-delivery',
    medications: [
      {
        id: 'med-1',
        name: 'Amoxicillin 500mg',
        quantity: 21,
        unitPrice: 0,
        isInsured: true,
        inStock: true,
      },
      {
        id: 'med-2',
        name: 'Paracetamol 500mg',
        quantity: 20,
        unitPrice: 1500,
        isInsured: false,
        inStock: true,
      },
    ],
    deliveryFee: 5000,
    totalAmount: 35000,
    insuredAmount: 0,
    cashAmount: 30000,
    deliveryAddress: '123 Main Street, Kampala',
    paymentMethod: 'cod',
    otp: '847291',
    createdAt: '2026-02-14T10:30:00Z',
    estimatedDelivery: '2026-02-15T14:00:00Z',
  },
  {
    id: 'order-2',
    profileId: 'profile-2',
    profileName: 'Jane Doe',
    profileInsurance: 'verified',
    prescriptionUrl: 'https://example.com/prescription-2.jpg',
    status: 'pricing-ready',
    medications: [
      {
        id: 'med-3',
        name: 'Metformin 850mg',
        quantity: 60,
        unitPrice: 0,
        isInsured: true,
        inStock: true,
      },
      {
        id: 'med-4',
        name: 'Vitamin D3',
        quantity: 30,
        unitPrice: 2000,
        isInsured: false,
        inStock: true,
      },
    ],
    deliveryFee: 5000,
    totalAmount: 65000,
    insuredAmount: 0,
    cashAmount: 60000,
    deliveryAddress: '123 Main Street, Kampala',
    createdAt: '2026-02-15T09:15:00Z',
  },
  {
    id: 'order-3',
    profileId: 'profile-4',
    profileName: 'James Doe',
    profileInsurance: 'none',
    prescriptionUrl: 'https://example.com/prescription-3.jpg',
    status: 'delivered',
    medications: [
      {
        id: 'med-5',
        name: 'Amoxicillin Syrup',
        quantity: 1,
        unitPrice: 15000,
        isInsured: false,
        inStock: true,
      },
      {
        id: 'med-6',
        name: 'Paracetamol Syrup',
        quantity: 1,
        unitPrice: 8000,
        isInsured: false,
        inStock: true,
      },
    ],
    deliveryFee: 5000,
    totalAmount: 28000,
    insuredAmount: 0,
    cashAmount: 23000,
    deliveryAddress: '123 Main Street, Kampala',
    paymentMethod: 'mtn',
    createdAt: '2026-02-10T15:20:00Z',
    estimatedDelivery: '2026-02-11T12:00:00Z',
  },
]

// Mock addresses
export const mockAddresses: Address[] = [
  {
    id: 'addr-1',
    label: 'Home',
    street: '123 Main Street',
    city: 'Kampala',
    zone: 'Central',
    instructions: 'Blue gate, ring the bell twice',
    isDefault: true,
  },
  {
    id: 'addr-2',
    label: 'Work',
    street: '456 Business Avenue',
    city: 'Kampala',
    zone: 'Business District',
    instructions: 'Reception on 3rd floor',
    isDefault: false,
  },
]

// Mock chat messages
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    senderId: 'user-1',
    senderName: 'John Doe',
    senderType: 'customer',
    message: 'Hello, I have a question about my order',
    timestamp: '2026-02-15T10:30:00Z',
  },
  {
    id: 'msg-2',
    senderId: 'pharmacy-1',
    senderName: 'Pharmacy Staff',
    senderType: 'pharmacy',
    message: 'Hello! How can I help you today?',
    timestamp: '2026-02-15T10:31:00Z',
  },
  {
    id: 'msg-3',
    senderId: 'user-1',
    senderName: 'John Doe',
    senderType: 'customer',
    message: 'When will my order be delivered?',
    timestamp: '2026-02-15T10:32:00Z',
  },
  {
    id: 'msg-4',
    senderId: 'pharmacy-1',
    senderName: 'Pharmacy Staff',
    senderType: 'pharmacy',
    message: 'Your order is out for delivery and should arrive by 2 PM today.',
    timestamp: '2026-02-15T10:33:00Z',
  },
]

// Delivery zones with fees
export const DELIVERY_ZONES = [
  { name: 'Central Kampala', fee: 5000 },
  { name: 'Greater Kampala', fee: 8000 },
  { name: 'Entebbe', fee: 15000 },
  { name: 'Wakiso', fee: 10000 },
  { name: 'Mukono', fee: 12000 },
]

