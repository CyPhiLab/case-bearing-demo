import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import '../app.css';
import SignalsApp from './SignalsApp.svelte';
import { initPreferences } from '../lib/state.svelte';

initPreferences();
export default mount(SignalsApp, { target: document.getElementById('app')! });
