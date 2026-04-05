import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.card}>
        <Text style={styles.heading}>About the Developer</Text>
        <Text style={styles.body}>
          Adnan Mustavi is a clinical researcher, data analyst, and app developer based in Toronto, Canada.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>About this App</Text>
        <Text style={styles.body}>
          This app aims to provide a privacy first, free, and open source alternative to other caffeine trackers. No accounts, no subscriptions, no data collection. Everything stays on your device.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Source Code</Text>
        <Text style={styles.body}>
          This app is fully open source. You can view, fork, and contribute to the codebase on GitHub.
        </Text>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL('https://github.com/mamustavi')}
        >
          <Text style={styles.linkText}>View on GitHub →</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDE8DD' },
  content: { padding: 40, paddingTop: 80 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Georgia',
    color: '#2d2d2d',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Menlo',
    fontWeight: '400',
    fontSize: 13,
    color: '#2d2d2d',
    lineHeight: 22,
  },
  linkButton: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontFamily: 'Menlo',
    fontWeight: '400',
    fontSize: 13,
    color: '#D7263D',
  },
});