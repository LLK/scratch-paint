module.exports = {
    root: true,
    extends: ['scratch', 'scratch/es6', 'scratch/react', 'import'],
    env: {
        browser: true
    },
    rules: {
        'import/no-mutable-exports': 'error',
        'import/no-commonjs': 'error',
        'import/no-amd': 'error',
        'import/no-nodejs-modules': 'error',
        'camelcase': [2, {
            properties: 'never', // This is from the base `scratch` config
            allow: ['^UNSAFE_'] // Allow until migrated to new lifecycle methods
        }]
    }
};
