import { Camera, Images, Image, GalleryHorizontalEnd, GalleryVerticalEnd, Clapperboard, Film, CloudUpload, Upload, FileText, ReceiptText, Settings, Settings2, CreditCard, Wallet, AudioLines, AudioWaveform } from 'lucide-react';
export const STUDIO_ICON_SIZES = Object.freeze({ xs:16, sm:18, md:20, lg:24, xl:28 });
const identities = new Map([[Camera,'camera'],[Images,'gallery'],[Image,'gallery'],[GalleryHorizontalEnd,'gallery'],[GalleryVerticalEnd,'gallery'],[Clapperboard,'timeline'],[Film,'timeline'],[CloudUpload,'upload'],[Upload,'upload'],[FileText,'invoice'],[ReceiptText,'invoice'],[Settings,'settings'],[Settings2,'settings'],[CreditCard,'payment'],[Wallet,'wallet'],[AudioLines,'intercom'],[AudioWaveform,'intercom']]);
const names = Object.freeze({camera:'camera',images:'gallery',image:'gallery',gallery:'gallery',galleryhorizontalend:'gallery',galleryverticalend:'gallery',timeline:'timeline',postproduction:'timeline',clapperboard:'timeline',film:'timeline',upload:'upload',cloudupload:'upload',invoice:'invoice',quotation:'invoice',document:'invoice',filetext:'invoice',receipttext:'invoice',settings:'settings',settings2:'settings',payment:'payment',creditcard:'payment',wallet:'wallet',intercom:'intercom',audiolines:'intercom',audiowaveform:'intercom'});
const normalise = value => String(value || '').replace(/^Lucide/,'').replace(/Icon$/,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export function resolveStudioIconKind(icon,name) {
  if (name) return names[normalise(name)] || 'generic';
  const component=icon?.type || icon;
  return identities.get(component) || names[normalise(component?.displayName || component?.render?.displayName || component?.name)] || 'generic';
}
export function studioIconSize(value) { return typeof value==='number' && Number.isFinite(value) ? Math.max(12,Math.min(64,Math.round(value))) : STUDIO_ICON_SIZES[value] || STUDIO_ICON_SIZES.md; }
export function studioIconActivity(value) { return typeof value==='number' && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0; }
