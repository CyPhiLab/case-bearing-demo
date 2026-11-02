import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import '../app.css';
import SensorsApp from './SensorsApp.svelte';
import { initPreferences } from '../lib/state.svelte';

initPreferences();
export default mount(SensorsApp, { target: document.getElementById('app')! });
