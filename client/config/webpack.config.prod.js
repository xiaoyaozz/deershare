const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const {
  cssLoaderWithModules,
  cssLoaderWithoutModules,
  postcssLoader,
  stylusLoader,
  babelLoader,
} = require('./loaders');
const paths = require('./paths');

module.exports = {
  mode: 'production',
  entry: paths.appIndexJs,
  devtool: false,
  output: {
    path: paths.appBuild,
    filename: 'index.bundle.js',
  },
  module: {
    rules: [
      {
        test: [/\.(js|jsx|mjs)$/],
        include: paths.appSrc,
        use: [babelLoader],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, cssLoaderWithoutModules, postcssLoader],
      },
      {
        test: /\.cm\.styl$/,
        use: [MiniCssExtractPlugin.loader, cssLoaderWithModules, postcssLoader, stylusLoader],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      title: '小鹿快传｜简单安全高效的P2P文件传输服务',
      template: paths.appHtml,
    }),
  ],
  devServer: {
    contentBase: './build',
  },
};
