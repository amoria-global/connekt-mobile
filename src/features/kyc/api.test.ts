import {
  getKyc,
  getChallengeToken,
  submitKyc,
  validateDocType,
  validateDocSide,
  type KycSubmissionPayload,
} from './api';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('KYC API Client', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getKyc', () => {
    it('normalizes status correctly when submitted and pending', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          kycStatus: 'PENDING',
          latestSubmission: {
            id: 'sub-123',
            createdAt: '2026-09-16 12:00:00',
            documentType: 'NATIONAL_ID',
            fullLegalName: 'Jane Doe',
          },
        },
      });

      const res = await getKyc();
      expect(res.status).toBe('PENDING');
      expect(res.submittedAt).toBe('2026-09-16 12:00:00');
      expect(res.documentType).toBe('NATIONAL_ID');
      expect(res.fullLegalName).toBe('Jane Doe');
      expect(api.get).toHaveBeenCalledWith('/customer/kyc/status');
    });

    it('normalizes NOT_SUBMITTED to NONE', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          kycStatus: 'NOT_SUBMITTED',
        },
      });

      const res = await getKyc();
      expect(res.status).toBe('NONE');
    });

    it('handles REJECTED with reviewComment', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          kycStatus: 'REJECTED',
          latestSubmission: {
            reviewComment: 'Image blurry. Please upload a clear photo.',
          },
        },
      });

      const res = await getKyc();
      expect(res.status).toBe('REJECTED');
      expect(res.rejectionReason).toBe('Image blurry. Please upload a clear photo.');
    });
  });

  describe('getChallengeToken', () => {
    it('fetches and returns the challengeToken string', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        action: 1,
        challengeToken: 'tok_challenge_abc123',
      });

      const token = await getChallengeToken();
      expect(token).toBe('tok_challenge_abc123');
      expect(api.post).toHaveBeenCalledWith('/customer/kyc/challenge-token');
    });
  });

  describe('submitKyc', () => {
    it('packages all fields into FormData and posts to /customer/kyc/submit', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        action: 1,
        message: 'KYC verification submitted successfully.',
        data: { id: 'kyc-999', status: 'PENDING' },
      });

      const payload: KycSubmissionPayload = {
        fullLegalName: 'Johnathan Doe',
        gender: 'Male',
        locationAddress: '123 Main St',
        documentType: 'NATIONAL_ID',
        challengeToken: 'tok_123',
        selfiePhoto: { uri: 'file:///selfie.jpg', name: 'selfie.jpg', type: 'image/jpeg' },
        governmentIdDocument: { uri: 'file:///id_front.jpg', name: 'id_front.jpg', type: 'image/jpeg' },
        governmentIdDocumentBack: { uri: 'file:///id_back.jpg', name: 'id_back.jpg', type: 'image/jpeg' },
      };

      const result = await submitKyc(payload);
      expect(result.action).toBe(1);
      expect(result.data?.status).toBe('PENDING');

      expect(api.post).toHaveBeenCalledTimes(1);
      const [path, formData] = (api.post as jest.Mock).mock.calls[0];
      expect(path).toBe('/customer/kyc/submit');
      expect(formData).toBeInstanceOf(FormData);
    });

    it('packages livenessFrames, challengeOrder, and challengeTimingsMs when provided', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        action: 1,
        message: 'KYC submitted with live evidence.',
      });

      const payload: KycSubmissionPayload = {
        fullLegalName: 'Jane Smith',
        gender: 'Female',
        documentType: 'PASSPORT',
        challengeToken: 'tok_live_456',
        challengeOrder: 'LOOK_STRAIGHT,TURN_LEFT,LOOK_STRAIGHT',
        challengeTimingsMs: '[1100,1650,1200]',
        selfiePhoto: { uri: 'file:///selfie.jpg', name: 'selfie.jpg', type: 'image/jpeg' },
        livenessFrames: [
          { uri: 'file:///frame_0.jpg', name: 'frame_0.jpg', type: 'image/jpeg' },
          { uri: 'file:///frame_1.jpg', name: 'frame_1.jpg', type: 'image/jpeg' },
        ],
        governmentIdDocument: { uri: 'file:///passport.jpg', name: 'passport.jpg', type: 'image/jpeg' },
      };

      const result = await submitKyc(payload);
      expect(result.action).toBe(1);
      expect(api.post).toHaveBeenCalledWith('/customer/kyc/submit', expect.any(FormData));
    });
  });

  describe('validateDocType', () => {
    it('sends documentType and image to /customer/kyc/validate-doc-type', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        status: 'MATCH',
        message: 'Document matches the selected type.',
      });

      const res = await validateDocType('NATIONAL_ID', {
        uri: 'file:///front.jpg',
        name: 'front.jpg',
        type: 'image/jpeg',
      });

      expect(res.status).toBe('MATCH');
      expect(api.post).toHaveBeenCalledWith('/customer/kyc/validate-doc-type', expect.any(FormData));
    });
  });

  describe('validateDocSide', () => {
    it('sends side and image to /customer/kyc/validate-doc-side', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        status: 'SIDE_MATCH',
        message: 'Image matches the expected side.',
      });

      const res = await validateDocSide('FRONT', {
        uri: 'file:///front.jpg',
        name: 'front.jpg',
        type: 'image/jpeg',
      });

      expect(res.status).toBe('SIDE_MATCH');
      expect(api.post).toHaveBeenCalledWith('/customer/kyc/validate-doc-side', expect.any(FormData));
    });
  });
});
