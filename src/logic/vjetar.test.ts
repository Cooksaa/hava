import { describe, expect, it } from 'vitest';
import { jadranskiKraj, odakle, vjetarRecenica } from './vjetar';

describe('vjetar', () => {
  it('strana svijeta', () => {
    expect(odakle(0)).toBe('sa sjevera');
    expect(odakle(350)).toBe('sa sjevera');
    expect(odakle(180)).toBe('s juga');
    expect(odakle(225)).toBe('s jugozapada');
    expect(odakle(-90)).toBe('sa zapada');
  });

  it('Hercegovina da, Sarajevo ne', () => {
    expect(jadranskiKraj(43.11, 17.68)).toBe(true); // Čapljina
    expect(jadranskiKraj(43.34, 17.81)).toBe(true); // Mostar
    expect(jadranskiKraj(42.71, 18.34)).toBe(true); // Trebinje
    expect(jadranskiKraj(43.86, 18.41)).toBe(false); // Sarajevo
    expect(jadranskiKraj(44.54, 18.67)).toBe(false); // Tuzla
  });

  it('bura i jugo samo na jugu', () => {
    expect(vjetarRecenica(45, 85, 40, true)).toBe('Jaka bura, udari do 85 km/h');
    expect(vjetarRecenica(25, 30, 150, true)).toBe('Umjereno jugo');
    expect(vjetarRecenica(25, 30, 150, false)).toBe('Umjeren vjetar s jugoistoka');
    expect(vjetarRecenica(14, 20, 40, true)).toBe('Slaba bura');
  });

  it('slab vjetar bez smjera, tišina bez ičega', () => {
    expect(vjetarRecenica(12, 18, 270)).toBe('Vjetar slab');
    expect(vjetarRecenica(3, 8, 90, true)).toBe('Bez vjetra');
  });

  it('stara prognoza bez smjera', () => {
    expect(vjetarRecenica(30, 60)).toBe('Umjeren vjetar, udari do 60 km/h');
  });
});
