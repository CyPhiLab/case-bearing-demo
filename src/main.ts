import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import './app.css';
import App from './App.svelte';
import { initPreferences } from './lib/state.svelte';

initPreferences();
export default mount(App, { target: document.getElementById('app')! });
