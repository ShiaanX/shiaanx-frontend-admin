// Builds the app for GitHub Pages and publishes it to the gh-pages branch.
// Preview link: https://shiaanx.github.io/shiaanx-frontend-admin/#/proto
//
// package.json "homepage" is "/admin" for the nginx test server, which would break asset paths on
// Pages, so PUBLIC_URL is overridden for this build only.
//
//   npm run deploy:preview                  build + publish
//   npm run deploy:preview -- --build-only  build, don't publish

const { execSync } = require('child_process');
const path = require('path');

const PUBLIC_URL = '/shiaanx-frontend-admin';
const root = path.resolve(__dirname, '..');
const buildOnly = process.argv.includes('--build-only');

execSync('npx react-scripts build', { cwd: root, stdio: 'inherit', env: { ...process.env, PUBLIC_URL } });

if (buildOnly) {
  console.log(`Built for ${PUBLIC_URL}/ — not published (--build-only).`);
  process.exit(0);
}

require('gh-pages').publish(
  path.join(root, 'build'),
  { branch: 'gh-pages', nojekyll: true, message: 'Deploy admin-flow preview' },
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Published: https://shiaanx.github.io${PUBLIC_URL}/#/proto`);
  }
);
