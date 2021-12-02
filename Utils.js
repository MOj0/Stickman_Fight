export class Utils
{
    static init(object, defaults, options)
    {
        // Convert dictionary to Json ..?
        let defaulted = Utils.clone(defaults || {});
        let filtered = Utils.clone(options || {});
        for(let key in filtered)
        {
            if(!defaulted.hasOwnProperty(key))
            {
                delete filtered[key];
            }
        }
        Object.assign(object, defaulted, filtered);
    }

    static clone(object)
    {
        return JSON.parse(JSON.stringify(object));
    }
}