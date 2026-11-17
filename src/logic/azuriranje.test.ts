import { describe, expect, it } from 'vitest';
import { odlukaAzuriranja, procitajIzdanje, type GhIzdanje, type Izdanje } from './azuriranje';

const BAZA = 'https://github.com/Cooksaa/hava/releases/download';

function gh(tag: string, imena: string[]): GhIzdanje {
  return {
    tag_name: tag,
    html_url: `https://github.com/Cooksaa/hava/releases/tag/${tag}`,
    assets: imena.map((name) => ({ name, browser_download_url: `${BAZA}/${tag}/${name}` })),
  };
}

describe('procitajIzdanje', () => {
  it('nalazi APK i web paket s minimalnim APK-om', () => {
    const iz = procitajIzdanje(gh('v0.2.3', ['Hava-0.2.3.apk', 'Hava-web-0.2.3-apk-0.2.0.zip']));
    expect(iz.verzija).toBe('0.2.3');
    expect(iz.apk).toBe(`${BAZA}/v0.2.3/Hava-0.2.3.apk`);
    expect(iz.web).toEqual({ url: `${BAZA}/v0.2.3/Hava-web-0.2.3-apk-0.2.0.zip`, minApk: '0.2.0' });
  });

  it('staro izdanje bez paketa: samo APK', () => {
    expect(procitajIzdanje(gh('v0.1.1', ['Hava-0.1.1.apk'])).web).toBeNull();
  });

  it('paket za drugu verziju se ne uzima', () => {
    expect(procitajIzdanje(gh('v0.2.3', ['Hava-web-0.2.2-apk-0.2.0.zip'])).web).toBeNull();
  });

  it('bez APK-a link vodi na stranicu izdanja', () => {
    expect(procitajIzdanje(gh('v0.2.3', [])).apk).toContain('/releases/tag/v0.2.3');
  });
});

describe('odlukaAzuriranja', () => {
  const izdanje = (verzija: string, minApk: string | null): Izdanje => ({
    verzija,
    apk: `apk-${verzija}`,
    web: minApk ? { url: `web-${verzija}`, minApk } : null,
  });

  it('nova web verzija na dovoljno novom APK-u: tiho', () => {
    expect(odlukaAzuriranja(izdanje('0.2.3', '0.2.0'), '0.2.1', '0.2.0')).toEqual({
      vrsta: 'tiho',
      verzija: '0.2.3',
      url: 'web-0.2.3',
    });
  });

  it('APK noviji od minimalnog: tiho', () => {
    expect(odlukaAzuriranja(izdanje('0.2.3', '0.2.0'), '0.2.1', '0.2.1').vrsta).toBe('tiho');
  });

  it('treba noviji APK: preuzmi', () => {
    expect(odlukaAzuriranja(izdanje('0.3.0', '0.3.0'), '0.2.3', '0.2.0')).toEqual({
      vrsta: 'preuzmi',
      verzija: '0.3.0',
      link: 'apk-0.3.0',
    });
  });

  it('izdanje bez paketa (0.1.x): preuzmi', () => {
    expect(odlukaAzuriranja(izdanje('0.1.1', null), '0.1.0', '0.1.0').vrsta).toBe('preuzmi');
  });

  it('već je ova verzija: ništa', () => {
    expect(odlukaAzuriranja(izdanje('0.2.3', '0.2.0'), '0.2.3', '0.2.0').vrsta).toBe('nista');
  });

  it('web dio noviji od izdanja (ne bi se smjelo desiti): ništa', () => {
    expect(odlukaAzuriranja(izdanje('0.2.3', '0.2.0'), '0.2.4', '0.2.0').vrsta).toBe('nista');
  });
});
