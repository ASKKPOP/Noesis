'use client';

/**
 * DistrictView — the district level of the Grid Station View (D-V3-44): one zone as a
 * city along the inside of its ring, drawn from the Grid's own lots. Opens over the
 * station view and closes back to it.
 */
import { useEffect, useRef } from 'react';
import type { ParcelFeedEntry } from './OrbitalGenesisMap';
import { districtCounts, layoutDistrict } from './district-layout';
import { mountDistrict, type DistrictHandle, type DistrictNous } from './district-scene';
import { mountBevyDistrict, rendererChoice } from './orbital-bevy';
import type { Translate } from './map-i18n';

export interface DistrictViewProps {
    zoneId: string;
    zoneLabel: string;
    /** The zone's colour, as 0xRRGGBB. */
    color: number;
    parcels: readonly ParcelFeedEntry[];
    /** The Nous standing in this district now. */
    residents: readonly DistrictNous[];
    t: Translate;
    onClose(): void;
    /** Hands the parent the way to flash a lot when the scene feed reports an event. */
    onHandle(handle: DistrictHandle | null): void;
}

export default function DistrictView({ zoneId, zoneLabel, color, parcels, residents, t, onClose, onHandle }: DistrictViewProps): React.ReactElement {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<DistrictHandle | null>(null);
    const lots = layoutDistrict(parcels, zoneId);
    const counts = districtCounts(lots);

    // The latest lots and Nous, so a scene that takes over (Bevy stopped) starts current.
    const now = useRef({ lots, residents });
    now.current = { lots, residents };

    useEffect(() => {
        const canvas = canvasRef.current; const overlay = overlayRef.current;
        if (!canvas || !overlay) return;
        let h: DistrictHandle;
        const attach = (next: DistrictHandle): void => {
            h = next; handleRef.current = next; onHandle(next);
            (window as unknown as { __districtScene?: DistrictHandle }).__districtScene = next; // for inspection, like __forestScene
            next.setLots(now.current.lots); next.setNous(now.current.residents);
        };
        // Bevy when it draws the station (option C, D-V3-45); three.js otherwise, or if Bevy stops.
        const bevy = rendererChoice(window.location.search) === 'three' ? null : mountBevyDistrict(overlay, canvas, color, () => attach(mountDistrict(canvas, color)));
        attach(bevy ?? mountDistrict(canvas, color));
        return () => { onHandle(null); h.dispose(); handleRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- one scene per opened district
    }, [zoneId, color]);

    // Redraw when the Grid's lots change (a purchase, a new building, someone entering).
    const signature = lots.map((l) => `${l.id}:${l.kind}:${l.condition}:${l.occupied ? 1 : 0}`).join('|');
    useEffect(() => { handleRef.current?.setLots(lots); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signature, zoneId]);

    const who = residents.map((n) => `${n.did}:${n.asleep ? 1 : 0}`).join('|');
    useEffect(() => { handleRef.current?.setNous(residents); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [who, zoneId]);

    const mono = "'JetBrains Mono', ui-monospace, monospace";
    return (
        <div ref={overlayRef} role="region" aria-label={t('districtOf', { zone: zoneLabel })} style={{ position: 'fixed', inset: 0, zIndex: 11, background: '#020610' }}>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', top: 18, left: 22, fontFamily: mono, color: '#f5f0ea' }}>
                <button
                    onClick={onClose}
                    style={{ fontFamily: mono, fontSize: 10.5, border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', borderRadius: 999, padding: '5px 12px', background: 'rgba(255,255,255,.04)', color: '#f5f0ea' }}
                >{t('backToStation')}</button>
                <div style={{ fontSize: 20, marginTop: 12, letterSpacing: '.04em' }}>{t('districtOf', { zone: zoneLabel })}</div>
                <div style={{ fontSize: 11, color: '#8a93a6', marginTop: 4 }}>{t('districtCounts', { lots: counts.lots, buildings: counts.buildings, occupied: counts.occupied })} · <b style={{ color: '#f5f0ea' }}>{t('districtNous', { n: residents.length })}</b></div>
            </div>
            <div style={{ position: 'absolute', bottom: 18, left: 22, fontFamily: mono, fontSize: 10.5, color: '#8a93a6', lineHeight: 1.7 }}>
                {t('districtHint')}<br />{t('districtRoofs')}
            </div>
        </div>
    );
}
