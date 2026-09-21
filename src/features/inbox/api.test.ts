import {
  listConversations,
  listMessages,
  sendMessage,
  normalizeChatImageUrl,
  getSelfIdSync,
} from './api';
import { api } from '@/api/client';
import { useAuth } from '@/store/auth';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('Inbox Chat API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.setState({
      user: {
        customerId: 'self-uuid-1234',
        email: 'client@example.com',
        firstName: 'Self',
        lastName: 'User',
      },
      session: {
        token: 'mock-jwt-token',
        user: {
          customerId: 'self-uuid-1234',
          email: 'client@example.com',
        },
      },
    });
  });

  describe('normalizeChatImageUrl', () => {
    it('normalizes relative /uploads paths to backend URL', () => {
      const url = normalizeChatImageUrl('/uploads/chat/photo.jpg');
      expect(url).toContain('photo.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('replaces old IP with backend URL', () => {
      const url = normalizeChatImageUrl('http://197.243.24.101/uploads/photo.jpg');
      expect(url).not.toContain('197.243.24.101');
      expect(url).toContain('/uploads/photo.jpg');
    });

    it('leaves valid https URLs untouched', () => {
      const url = normalizeChatImageUrl('https://cdn.example.com/avatar.png');
      expect(url).toBe('https://cdn.example.com/avatar.png');
    });
  });

  describe('getSelfIdSync', () => {
    it('extracts self customerId from Zustand user store', () => {
      expect(getSelfIdSync()).toBe('self-uuid-1234');
    });
  });

  describe('listConversations', () => {
    it('maps partner correctly from backend ConversationResponseDTO', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        action: 1,
        message: 'Conversations retrieved successfully',
        data: [
          {
            id: 'partner-uuid-9999',
            participants: [
              {
                id: 'self-uuid-1234',
                name: 'Self User',
                image: 'https://example.com/self.jpg',
                userType: 'Client',
                isOnline: true,
              },
              {
                id: 'partner-uuid-9999',
                name: 'John Photographer',
                image: 'https://example.com/john.jpg',
                userType: 'Photographer',
                isOnline: false,
              },
            ],
            lastMessage: {
              id: 'msg-1',
              conversationId: 'partner-uuid-9999',
              senderId: 'partner-uuid-9999',
              content: 'Hey, are you free tomorrow?',
              type: 'text',
              createdAt: '2026-09-20T15:00:00',
              isRead: false,
            },
            unreadCount: 1,
          },
        ],
      });

      const convs = await listConversations();
      expect(convs).toHaveLength(1);
      expect(convs[0].id).toBe('partner-uuid-9999');
      expect(convs[0].partnerId).toBe('partner-uuid-9999');
      expect(convs[0].name).toBe('John Photographer');
      expect(convs[0].lastMessage).toBe('Hey, are you free tomorrow?');
      expect(convs[0].unreadCount).toBe(1);
    });
  });

  describe('listMessages', () => {
    it('determines isMine correctly based on senderId and selfId', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        action: 1,
        message: 'success',
        data: [
          {
            id: 'msg-1',
            senderId: 'partner-uuid-9999',
            content: 'Hello from photographer',
            createdAt: '2026-09-20T14:55:00',
            isRead: true,
          },
          {
            id: 'msg-2',
            senderId: 'self-uuid-1234',
            content: 'Hello from client',
            createdAt: '2026-09-20T14:56:00',
            isRead: true,
          },
        ],
      });

      const msgs = await listMessages('partner-uuid-9999');
      expect(msgs).toHaveLength(2);
      expect(msgs[0].isMine).toBe(false);
      expect(msgs[0].text).toBe('Hello from photographer');
      expect(msgs[1].isMine).toBe(true);
      expect(msgs[1].text).toBe('Hello from client');
    });
  });

  describe('sendMessage', () => {
    it('sends recipientId, content and senderId via FormData to /chat/send', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        action: 1,
        message: 'Message sent successfully',
        data: { id: 'msg-real-123' },
      });

      await sendMessage('partner-uuid-9999', 'Let us confirm the shoot');

      expect(api.post).toHaveBeenCalledTimes(1);
      const [endpoint, form] = (api.post as jest.Mock).mock.calls[0];
      expect(endpoint).toBe('/chat/send');
      expect(form).toBeInstanceOf(FormData);
    });
  });
});
