const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: {
    polyfill: '@babel/polyfill',
    app: './src/exports.js',
  },
  mode: 'production',
  plugins: [
    new HtmlWebpackPlugin(),
  ],
  output: {
    path: path.resolve(__dirname, 'browser'),
    filename: '[name].bundle.js',
    libraryTarget: 'var',
    library: 'DirectBinaryUtils',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  node: {
    console: false,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
  },
};
