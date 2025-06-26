
export const getEnvVariables = () => {

    // import.meta.env;

    return {
        ...import.meta.env,
    }
}

export default getEnvVariables;