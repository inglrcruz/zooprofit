import { Image } from 'react-native';

export function Logo() {
  return (
    <Image
      source={require('../../assets/images/300x69.png')}
      accessibilityLabel="ZooProfit"
      resizeMode="contain"
      style={{ width: 174, height: 40, marginTop: 32 }}
    />
  );
}
