import { describe, expect, it } from 'vitest';
import { jeNovija, versionCode } from './verzija';

describe('verzije', () => {
  it('novija po svakom dijelu', () => {
    expect(jeNovija('v0.2.0', '0.1.9')).toBe(true);
    expect(jeNovija('0.1.10', '0.1.9')).toBe(true);
    expect(jeNovija('1.0.0', '0.99.99')).toBe(true);
  });

  it('ista ili starija nije novija', () => {
    expect(jeNovija('v0.1.0', '0.1.0')).toBe(false);
    expect(jeNovija('0.1.0', '0.2.0')).toBe(false);
  });

  it('nepoznat oblik se ignoriše', () => {
    expect(jeNovija('najnovija', '0.1.0')).toBe(false);
    expect(jeNovija('v1.0', '0.1.0')).toBe(false);
  });

  it('versionCode raste s verzijom', () => {
    expect(versionCode('v0.1.0')).toBe(100);
    expect(versionCode('0.1.1')).toBe(101);
    expect(versionCode('1.0.0')).toBe(10000);
    expect(versionCode('0.100.0')).toBeNull();
    const redom = ['0.1.0', '0.1.1', '0.2.0', '0.10.3', '1.0.0', '1.2.0'].map((v) => versionCode(v)!);
    expect([...redom].sort((a, b) => a - b)).toEqual(redom);
  });
});
