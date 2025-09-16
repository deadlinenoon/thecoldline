const withAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' });
module.exports = withAnalyzer({
  swcMinify: true, // ensure minification is ON
});
