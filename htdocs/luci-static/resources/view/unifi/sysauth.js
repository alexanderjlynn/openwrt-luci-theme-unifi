'use strict';
'require ui';
'require view';

return view.extend({
	render() {
		const source = document.querySelector('.unifi-auth-source');
		const form = source.querySelector('form');
		const button = source.querySelector('button');
		const card = E('div', { class: 'unifi-login-card' }, [
			E('div', { class: 'unifi-login-brand' }, [
				E('img', { src: L.resource('unifi/mark.svg'), alt: '' }),
				E('span', {}, 'Network')
			]),
			E('div', { class: 'unifi-login-copy' }, [
				E('h1', {}, _('Welcome back')),
				E('p', {}, _('Sign in to manage this OpenWrt gateway.'))
			]),
			...Array.from(source.children)
		]);

		form.addEventListener('keypress', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				button.click();
			}
		});

		button.addEventListener('click', () => {
			button.disabled = true;
			button.textContent = _('Signing in…');
			form.submit();
		});

		document.body.appendChild(E('main', { class: 'unifi-login-page' }, [card]));
		window.requestAnimationFrame(() => card.classList.add('is-ready'));
		const password = document.querySelector('#luci_password');
		if (password) password.focus();
		return '';
	},
	addFooter() {}
});
