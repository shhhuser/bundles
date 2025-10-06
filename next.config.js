/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: { unoptimized: true } // avoid Next Image lambda on Vercel Free
};
