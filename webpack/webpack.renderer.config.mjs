import path from 'path';

export default {
  target: 'electron-renderer',
  entry: './src/renderer/index.js',
  output: {
    path: path.resolve('dist/renderer'),
    filename: 'renderer.js',
  },
  mode: 'development',
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
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.css', '.mjs'],
  },
};
