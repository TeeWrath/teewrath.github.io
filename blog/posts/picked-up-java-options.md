
Was just trying to code in my Kali Linux OS and encountered this:

```
Picked up JAVAOPTIONS: -Dawt.useSystemAAFontSettings=on -Dswing.aatext=true
```

On googling, I found that the message *"Picked up JAVAOPTIONS"* implies that the Java runtime has found this setting in your environment variables. The solution depends on which operating system you are running.

## Solution that worked for me

Simply ran the following command:

```bash
_SILENT_JAVA_OPTIONS="$_JAVA_OPTIONS" && unset JAVAOPTIONS && alias java='java "$_SILENT_JAVA_OPTIONS"'
```

If it doesn't work for you, check this out:  
[Stack Overflow - Picked up JAVA_OPTIONS in Kali Linux](https://stackoverflow.com/questions/59478100/picked-up-java-options-in-kali-linux)

---

> Been facing a lot of never-seen-before errors and usually it takes hours to understand the reason behind them and solve them. I have to look up many websites and try many things, which I find very arduous, so decided to share this so that if someone also faces it, it might help.
