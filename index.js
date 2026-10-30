// The offer call task is defined here, before the router starts, because the background task that wakes the app
// for a new offer runs this entry file without ever rendering a screen.
import './src/features/hybrid/offerCallTask';
import 'expo-router/entry';
