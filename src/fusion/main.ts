import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import '../app.css';
import FusionApp from './FusionApp.svelte';
import { initPreferences } from '../lib/state.svelte';

initPreferences();
export default mount(FusionApp, { target: document.getElementById('app')! });
