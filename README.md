# Caffeine Tracker

A free, open source, privacy first caffeine tracking app for iOS. No accounts, no subscriptions, no data collection. Everything stays on your device.

---

## Screenshots

*Coming soon*

---

## Features

- **Quick Log** One tap logging for espresso, coffee, tea, energy drinks, and more
- **610 Drink Database** Searchable database of popular drinks with accurate caffeine content, including Tim Hortons, Starbucks, McCafe, Red Bull, Monster, and hundreds more
- **Live Caffeine Decay** Real time display of how much caffeine is currently in your system, updated every minute using a 5 hour half life model
- **Sleep Safety Indicator** Know exactly when your caffeine will drop to a safe level for sleep
- **Smart Notifications** Get notified 30 minutes before your caffeine drops to a sleep safe level
- **Today's Log** View and delete all drinks logged today
- **History** Full log of every drink ever recorded, grouped by date
- **Privacy First** All data is encrypted and stored locally using iOS Keychain via Expo SecureStore. Nothing is ever sent to a server.

---

## Privacy

This app collects no data whatsoever. There are no analytics, no crash reporting, no third party SDKs, and no network requests. Your caffeine logs are encrypted at rest using iOS Keychain and never leave your device.

---

## Tech Stack

- [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) for encrypted local storage
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) for local push notifications
- [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) for tactile feedback

---

## Getting Started

### Prerequisites

- Node.js v20 or higher
- [Expo Go](https://expo.dev/client) installed on your iPhone
- A Linux, macOS, or Windows machine

### Installation

```bash
git clone https://github.com/mamustavi/caffeine-tracker.git
cd caffeine-tracker
npm install
npx expo start
```

Scan the QR code with your iPhone camera to open the app in Expo Go.

---

## Building for Production

This app uses [EAS Build](https://docs.expo.dev/build/introduction/) to produce a production iOS binary without requiring a Mac.

```bash
npm install -g eas-cli
eas login
eas build --platform ios
```

You will need an [Apple Developer account](https://developer.apple.com/) ($99/year) to submit to the App Store.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## Caffeine Database

The drink database (`assets/caffeine_db.json`) contains 610 drinks across five categories: Coffee, Energy Drinks, Energy Shots, Soft Drinks, Tea, and Water. Data is sourced from publicly available nutritional information.

If you would like to add or correct a drink entry, please open a Pull Request with your changes to the JSON file.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Developer

**Adnan Mustavi** is a researcher, data analyst, and app developer based in Toronto, Canada.

[github.com/mamustavi](https://github.com/mamustavi)
