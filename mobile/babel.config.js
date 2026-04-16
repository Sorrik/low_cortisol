module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Обязательно последним
      'react-native-reanimated/plugin',
    ],
  };
};