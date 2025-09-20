import path from 'path';

describe('NFL logo helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const importLogos = async () => {
    jest.resetModules();
    return import(path.join(process.cwd(), 'lib/logos'));
  };

  it('falls back to static NFL CDN when NEXT_PUBLIC_LOGO_CDN is unset', async () => {
    delete process.env.NEXT_PUBLIC_LOGO_CDN;
    const { teamLogoUrl } = await importLogos();
    const url = teamLogoUrl('Detroit Lions');

    expect(url.startsWith('https://static.www.nfl.com/')).toBe(true);
    expect(url.endsWith('/DET')).toBe(true);
  });

  it('uses configured CDN when NEXT_PUBLIC_LOGO_CDN is set', async () => {
    process.env.NEXT_PUBLIC_LOGO_CDN = 'https://cdn.example.com';
    const { teamLogo, teamLogoUrl } = await importLogos();

    expect(teamLogo('DET')).toBe('https://cdn.example.com/DET.svg');
    expect(teamLogoUrl('Denver Broncos')).toBe('https://cdn.example.com/DEN.svg');
  });

  it('returns empty string for unknown teams', async () => {
    delete process.env.NEXT_PUBLIC_LOGO_CDN;
    const { teamLogoUrl } = await importLogos();

    expect(teamLogoUrl('Metropolis Meteors')).toBe('');
  });
});
