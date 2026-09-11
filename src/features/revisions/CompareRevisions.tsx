export type RevisionComparison = {
  revisionId: string;
  sceneAssetId: string;
  assetIds?: string[];
};

export type CompareRevisionsProps = {
  left: RevisionComparison;
  right: RevisionComparison;
};

const RevisionPane = ({ side, revision }: { side: string; revision: RevisionComparison }) => (
  <section className="revision-comparison__pane" aria-label={`${side} revision`}>
    <p className="section-kicker">{side}</p>
    <h2>{revision.revisionId}</h2>
    <p>Scene: {revision.sceneAssetId}</p>
    {revision.assetIds && <p>Assets: {revision.assetIds.length}</p>}
  </section>
);

export const CompareRevisions = ({ left, right }: CompareRevisionsProps) => (
  <div className="revision-comparison" aria-label="Compare revisions">
    <RevisionPane side="Before" revision={left} />
    <RevisionPane side="After" revision={right} />
  </div>
);
