import type { WorkspaceHandle } from '../features/workspace/open-workspace';

export const designerArtworkScheme = 'designhub-artwork';

type ArtworkReader = (
  workspace: WorkspaceHandle,
  workspaceId: string,
  artworkId: string,
) => Promise<{ artworkId: string; dataUrl: string } | null>;

const artworkDataUrlPattern = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/u;

const notFound = (): Response => new Response(null, { status: 404 });

const parseArtworkId = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== `${designerArtworkScheme}:`
      || !url.hostname
      || url.username
      || url.password
      || url.port
      || url.pathname
      || url.search
      || url.hash
    ) return null;
    return url.hostname;
  } catch {
    return null;
  }
};

export const createDesignerArtworkProtocolHandler = (
  getWorkspace: () => WorkspaceHandle | null,
  readArtwork: ArtworkReader,
) => async (request: { url: string }): Promise<Response> => {
  const artworkId = parseArtworkId(request.url);
  const workspace = getWorkspace();
  if (!artworkId || !workspace) return notFound();
  try {
    const artwork = await readArtwork(
      workspace,
      workspace.workspace.workspaceId,
      artworkId,
    );
    if (!artwork || artwork.artworkId !== artworkId) return notFound();
    const match = artworkDataUrlPattern.exec(artwork.dataUrl);
    if (!match) return notFound();
    return new Response(Buffer.from(match[2], 'base64'), {
      headers: {
        'cache-control': 'no-store',
        'content-type': match[1],
      },
    });
  } catch {
    return notFound();
  }
};
