import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

export default function Notifications() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('http://10.194.216.149:8000/api/notifications/2/')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <FlatList
      data={data}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => (
        <View style={{ padding: 15 }}>
          <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
          <Text>{item.message}</Text>
        </View>
      )}
    />
  );
}