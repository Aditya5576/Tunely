import { apiService, API_BASE_URL } from '../apiService';
import { storageService } from '../storageService';
import { THEMES } from '../../theme/theme';

describe('Tunely Mobile Services & Foundation Verification', () => {
  test('API Base URL is configured correctly', () => {
    expect(API_BASE_URL).toBeTruthy();
    expect(API_BASE_URL).toContain('https://');
  });

  test('Theme tokens contain 5 preserved visual themes', () => {
    expect(THEMES.default).toBeDefined();
    expect(THEMES.cyberpunk).toBeDefined();
    expect(THEMES.emerald).toBeDefined();
    expect(THEMES.violet).toBeDefined();
    expect(THEMES.sunset).toBeDefined();

    expect(THEMES.default.colors.primary).toBe('#00e5ff');
    expect(THEMES.cyberpunk.colors.primary).toBe('#ff007f');
    expect(THEMES.emerald.colors.primary).toBe('#10b981');
    expect(THEMES.violet.colors.primary).toBe('#8b5cf6');
    expect(THEMES.sunset.colors.primary).toBe('#f59e0b');
  });
});
