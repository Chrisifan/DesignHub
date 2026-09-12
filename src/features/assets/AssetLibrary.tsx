import type { AssetImportResult, ManagedAsset } from './import-assets';

export type AssetLibraryProps = {
  assets?: ManagedAsset[];
  results?: AssetImportResult[];
  onSelect?: (asset: ManagedAsset) => void;
};

export const AssetLibrary = ({ assets = [], results = [], onSelect }: AssetLibraryProps) => (
  <section aria-label="Asset library">
    <h2>Assets</h2>
    {results.length > 0 && (
      <ul aria-label="Import status">
        {results.map((result, index) => {
          const name = result.status === 'error' ? result.item.name : result.asset.name;
          return (
          <li key={`${name}:${index}`}>
            <span>{name}</span>
            <span>{result.status === 'success' ? 'Imported' : 'Failed'}</span>
          </li>
          );
        })}
      </ul>
    )}
    {results.some((result) => result.status === 'error') && (
      <ul aria-label="Import errors">
        {results.filter((result): result is Extract<AssetImportResult, { status: 'error' }> => result.status === 'error').map((result) => <li key={`${result.item.name}:${result.error}`}>{result.item.name}: {result.error}</li>)}
      </ul>
    )}
    {assets.length === 0 ? <p>No managed assets.</p> : <ul>
        {assets.map((asset) => <li key={asset.id}>
          <button type="button" onClick={() => onSelect?.(asset)}>{asset.name}</button>
          <span>{asset.format}{asset.decode?.width && asset.decode?.height ? ` · ${asset.decode.width} × ${asset.decode.height}` : ''}</span>
        {asset.externalReference && <span>External reference</span>}
      </li>)}
    </ul>}
  </section>
);
