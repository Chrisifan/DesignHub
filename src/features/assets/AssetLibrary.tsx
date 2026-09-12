import { getMessages, type Locale } from '../../app/i18n';
import type { AssetImportResult, ManagedAsset } from './import-assets';

export type AssetLibraryProps = {
  locale: Locale;
  assets?: ManagedAsset[];
  results?: AssetImportResult[];
  onSelect?: (asset: ManagedAsset) => void;
};

export const AssetLibrary = ({ locale, assets = [], results = [], onSelect }: AssetLibraryProps) => {
  const messages = getMessages(locale);
  return (
  <section aria-label={messages.assetLibraryLabel}>
    <h2>{messages.assetLibraryTitle}</h2>
    {results.length > 0 && (
      <ul aria-label={messages.assetImportStatus}>
        {results.map((result, index) => {
          const name = result.status === 'error' ? result.item.name : result.asset.name;
          return (
          <li key={`${name}:${index}`}>
            <span>{name}</span>
            <span>{result.status === 'success' ? messages.assetImported : messages.assetFailed}</span>
          </li>
          );
        })}
      </ul>
    )}
    {results.some((result) => result.status === 'error') && (
      <ul aria-label={messages.assetImportErrors}>
        {results.filter((result): result is Extract<AssetImportResult, { status: 'error' }> => result.status === 'error').map((result) => <li key={`${result.item.name}:${result.error}`}>{result.item.name}: {result.error}</li>)}
      </ul>
    )}
    {assets.length === 0 ? <p>{messages.assetEmpty}</p> : <ul>
        {assets.map((asset) => <li key={asset.id}>
          <button type="button" onClick={() => onSelect?.(asset)}>{asset.name}</button>
          <span>{asset.format}{asset.decode?.width && asset.decode?.height ? ` · ${asset.decode.width} × ${asset.decode.height}` : ''}</span>
        {asset.externalReference && <span>{messages.assetExternal}</span>}
      </li>)}
    </ul>}
  </section>
  );
};
