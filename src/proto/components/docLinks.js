// Shared by Documents received, earlier versions and the complaints card.
export const isStepFile = (name) => /\.(step|stp)$/i.test(name || '');
export const view3dPath = (fileKey) => `/proto/view3d/${encodeURIComponent(fileKey)}`;
