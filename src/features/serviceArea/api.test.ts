import { api } from '@/api/client';
import { getAreaDetails, getServiceArea, removeServiceArea, saveServiceArea, searchAreas } from './api';

jest.mock('@/api/client', () => ({
  api: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
  requireOk: (res: unknown) => {
    if (res && typeof res === 'object' && (res as { action?: unknown }).action !== 1) throw { status: 200, message: 'failed' };
    return res;
  },
}));

const get = api.get as jest.Mock;
const put = api.put as jest.Mock;
const del = api.delete as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('service area api', () => {
  describe('searchAreas', () => {
    it('does not search for fewer than two letters', async () => {
      expect(await searchAreas('G')).toEqual([]);
      expect(await searchAreas('  ')).toEqual([]);
      expect(get).not.toHaveBeenCalled();
    });

    it('asks our own area search, as a guest call, with the text encoded', async () => {
      get.mockResolvedValue({ action: 1, data: { predictions: [] } });
      await searchAreas('Gis hushu&x=1');
      expect(get).toHaveBeenCalledWith('/public/places/areas?input=Gis%20hushu%26x%3D1', { skipAuth: true });
    });

    it('keeps the name and where it is, drops duplicates and anything without an id or a name', async () => {
      get.mockResolvedValue({
        action: 1,
        data: {
          predictions: [
            { placeId: 'a1', mainText: 'Gishushu', secondaryText: 'Kigali, Rwanda', description: 'Gishushu, Kigali, Rwanda' },
            { placeId: 'a1', mainText: 'Gishushu', secondaryText: 'Kigali, Rwanda' },
            { placeId: 'a2', description: 'Gisozi, Gasabo, Kigali' },
            { mainText: 'No id' },
            { placeId: 'a3' },
          ],
        },
      });
      expect(await searchAreas('Gis')).toEqual([
        { placeId: 'a1', name: 'Gishushu', secondary: 'Kigali, Rwanda' },
        { placeId: 'a2', name: 'Gisozi', secondary: 'Gasabo, Kigali' },
      ]);
    });

    it('lets a failure through so the screen can offer "Try again", rather than showing "no areas"', async () => {
      get.mockRejectedValue({ status: 503, message: 'down' });
      await expect(searchAreas('Gis')).rejects.toMatchObject({ status: 503 });
    });
  });

  describe('getAreaDetails', () => {
    it('reads the chosen area, its parents, whether it is allowed, and its centre for the preview', async () => {
      get.mockResolvedValue({
        action: 1,
        data: { placeId: 'a1', name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', isArea: true, supported: true, latitude: -1.954, longitude: 30.091 },
      });
      expect(await getAreaDetails('a1')).toEqual({
        placeId: 'a1', name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', isArea: true, supported: true, latitude: -1.954, longitude: 30.091,
      });
      expect(get).toHaveBeenCalledWith('/public/places/area?placeId=a1', { skipAuth: true });
    });

    it('treats a missing flag as "no": an area is never assumed to be allowed', async () => {
      get.mockResolvedValue({ action: 1, data: { name: 'Somewhere' } });
      const d = await getAreaDetails('x');
      expect(d.isArea).toBe(false);
      expect(d.supported).toBe(false);
      expect(d.latitude).toBeNull();
    });
  });

  describe('saving and removing', () => {
    it('sends ONLY the place id when saving: no coordinates, no name', async () => {
      put.mockResolvedValue({ action: 1, data: { set: true, name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', latitude: -1.954, longitude: 30.091 } });
      const a = await saveServiceArea('a1');
      expect(put).toHaveBeenCalledTimes(1);
      expect(put.mock.calls[0][0]).toBe('/photographer/service-area');
      expect(put.mock.calls[0][1]).toEqual({ placeId: 'a1' });
      expect(Object.keys(put.mock.calls[0][1])).toEqual(['placeId']);
      expect(a).toMatchObject({ set: true, name: 'Gishushu' });
    });

    it('treats action 0 as a failure even on HTTP 200', async () => {
      put.mockResolvedValue({ action: 0, message: 'Choose an area or neighbourhood, not a street address.' });
      await expect(saveServiceArea('a1')).rejects.toBeDefined();
    });

    it('removes the area through DELETE and reads back "not set"', async () => {
      del.mockResolvedValue({ action: 1, data: { set: false } });
      const a = await removeServiceArea();
      expect(del).toHaveBeenCalledWith('/photographer/service-area');
      expect(a.set).toBe(false);
      expect(a.name).toBeNull();
    });
  });

  describe('getServiceArea', () => {
    it('reads the saved area, or "not set"', async () => {
      get.mockResolvedValueOnce({ action: 1, data: { set: true, name: 'Gishushu', context: 'Gasabo, Kigali', country: 'RW', setAt: '2026-11-13T10:00:00', latitude: -1.954, longitude: 30.091 } });
      expect(await getServiceArea()).toMatchObject({ set: true, name: 'Gishushu', latitude: -1.954 });
      get.mockResolvedValueOnce({ action: 1, data: { set: false, name: null } });
      expect((await getServiceArea()).set).toBe(false);
    });
  });
});
