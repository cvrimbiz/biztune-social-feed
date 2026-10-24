import { metaAdapter } from './meta.mjs';
import { tiktokAdapter } from './tiktok.mjs';
import { amazonAdapter } from './amazon.mjs';
export const ADAPTERS = [metaAdapter, tiktokAdapter, amazonAdapter];
export { buildPreview, previewCsv, previewJson, previewFilename, PREVIEW_BANNER, canonicalRow, eligibility } from './common.mjs';
