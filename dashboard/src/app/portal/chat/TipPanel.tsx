import dynamic from 'next/dynamic';

export default dynamic(() => import('./TipPanelInner'), { ssr: false });
