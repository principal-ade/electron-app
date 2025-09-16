const signNativeModules = require('./sign-native-modules');

exports.default = async function afterPack(context) {
  console.log('\n=== After Pack Hook ===\n');
  
  // Sign native modules
  await signNativeModules.default(context);
  
  // You can add other post-pack tasks here
  console.log('\n=== After Pack Complete ===\n');
};