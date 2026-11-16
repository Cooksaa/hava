/* GPS. Pita se samo kad korisnik dodirne "Moja lokacija", nikad pri otvaranju. */

export type GreskaLokacije = 'zabranjeno' | 'nedostupno';

export function gdjeSam(): Promise<{ lat: number; lon: number }> {
  return new Promise((rijesi, odbij) => {
    if (!('geolocation' in navigator)) {
      odbij('nedostupno' satisfies GreskaLokacije);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => rijesi({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => odbij((e.code === e.PERMISSION_DENIED ? 'zabranjeno' : 'nedostupno') satisfies GreskaLokacije),
      // Za prognozu ne treba tačnost u metar, a brže je i štedi bateriju.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}
