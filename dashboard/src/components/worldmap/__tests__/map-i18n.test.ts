import { describe, expect, it } from 'vitest';
import { LANGS, STRINGS, pickLang, translator } from '../map-i18n';
import { describeGrid } from '../grid-description';

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe('map languages', () => {
    it('offers English, Spanish, Japanese, Korean, Vietnamese and Filipino', () => {
        expect(LANGS.map((l) => l.code)).toEqual(['en', 'es', 'ja', 'ko', 'vi', 'fil']);
    });

    it('every language fills every line and keeps its placeholders', () => {
        for (const { code } of LANGS) {
            for (const [key, english] of Object.entries(STRINGS.en)) {
                const line = STRINGS[code][key as keyof typeof STRINGS.en];
                expect(line.trim(), `${code}.${key}`).not.toBe('');
                expect(placeholders(line), `${code}.${key}`).toEqual(placeholders(english));
            }
        }
    });

    it('fills placeholders', () => {
        expect(translator('en')('enter', { name: 'Genesis' })).toBe('Enter Genesis');
        expect(translator('ko')('dayMany', { n: 37 })).toBe('37일');
    });

    it('starts in the saved language, else the browser language, else English', () => {
        expect(pickLang('ja', ['ko-KR'])).toBe('ja');
        expect(pickLang(null, ['ko-KR', 'en-US'])).toBe('ko');
        expect(pickLang('xx', ['tl-PH'])).toBe('fil');
        expect(pickLang(null, ['fr-FR'])).toBe('en');
    });

    it('words the Grid description in the chosen language', () => {
        const d = describeGrid('Moon', { grid: null, registryLoaded: true, status: null, clock: null, profile: null, profileNeedsSignIn: false, zoneLabels: [], land: null }, 0, translator('es'));
        expect(d.title).toBe('Grid Moon');
        expect(d.rows).toEqual([{ label: 'Estado', value: 'Vacío, a la espera de carta' }]);
    });
});
