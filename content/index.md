---
title: Welcome!
cssclasses:
  - no-date
  - no-title
---



# Welcome to **GDPRed**!

... Where the labyrinthine chaos of data protection rulings has been coaxed into something that might, under favorable lighting and with one eye closed, resemble navigable terrain. 

Here lurk not dragons, but something far more terrifying: the Court of Justice of the European Union — an assembly of individuals whose collective mission appears to be ensuring that legal clarity remains purely theoretical and concision is punished with 174 additional paragraphs.

"_But what about Case C-740/22?_" you ask innocently.

"_Ah yes_," replies the Court with a sinister smile, adjusting its robes, "_that's on page 47, paragraph 92, which refers you to Article 4(1), which is best understood through the lens of Case C-439/19, which cannot be comprehended without first reading Articles 5, 13, and 73(c), which naturally lead back to Case C-268/21. Was that not perfectly clear?_"

It is at this point your average person sighs, rubs their temples, and mutters something about '*a high level of protection for natural persons in their data*' before reaching for the extra-strength aspirin.

This website exists because I believe that finding your way through this legal labyrinth should not require a herd of cats on a unicycle, three wizards, and a compass blessed by bureaucratic saints. 
I have gathered every GDPR judgment in one place, indexed by article, topic, and date. You can trace connections between cases, follow the breadcrumb trail from one ruling to related ones, and see which articles the Court keeps muttering about in its sleep. No simplification, just the kind of organization that brings tears of joy to the eyes of librarians and mild panic to those who profit from legal confusion.

**DISCLAIMER: This website is for informational purposes only, much like how the CJEU's 9831-page rulings are "for clarity." While I've done my utmost to map this legal labyrinth, I cannot guarantee that the Court hasn't, since yesterday, invented seven new principles, referenced three non-existent articles, or decided that the entire GDPR should now be interpreted through the lens of 17th-century maritime law. Always consult official sources, preferably with adequate provisions of caffeine and sanity breaks.**

---
## Features and roadmap

Still in? Awesome! My suggestion is to start with [[Case law by date|browsing by the case timeline]] or just dive straight into the judgements. You will find the links to other cases referencing it on the right side (or, if on a phone, under the final ruling).

If more practical, just pick an article and look at the list of all the cases referring to it. Alternatively, cases are [[Browse by topic|grouped by topics]], although that is very much a work in progress.

The site shall forever be free (as in ad-free and real-money-free), and I will update it regularly (assuming that there is sufficient interest). On my roadmap:

- Review cases more carefully for references to multiple articles or outdated ones
- Make final rulings more easily accessible (top of the case?)
- Add better sorting/filtering by topics
- Enhance the overall UI/UX

As mentioned, this is an open-source project, so if you want to contribute, drop me a line!

---

## FAQ

<div class="faq-container">
  <div class="faq-item">
    <input type="checkbox" id="faq-1" class="faq-toggle">
    <label for="faq-1" class="faq-question">How current is this information?</label>
    <div class="faq-answer">
      <p>Updated more regularly than the Court's understanding of technology. Which is to say: frequently, but always one step behind.</p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq-2" class="faq-toggle">
    <label for="faq-2" class="faq-question">Found a mistake?</label>
    <div class="faq-answer">
      <p>I've made an error somewhere in this maze? Impossible!¹ Please inform me of this reality breach via the contact form at <a href="https://milos.no/#contact">milos.no</a>, or drop me a message on <a href="https://www.linkedin.com/in/milosnovovic/">LinkedIn</a>, within 72 hours at the latest. If you feel like helping even more, this entire website is open-source -- let me know if you would like to contribute more directly!</p>
      <p>¹Actually quite possible, probable even.</p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq-3" class="faq-toggle">
    <label for="faq-3" class="faq-question">Can you make...?</label>
    <div class="faq-answer">
      <p>Do you have a brilliant idea? I'd love to hear it! All ideas will be considered. (BTW, yes, I have considered adding free AI summaries. I am just scared people would take them too seriously. But we'll see. Maybe.)</p>
      <p><em>DISCLAIMER: Implementation subject to time constraints and the mysterious behavior of code when I press random keys while hoping for the best.</em></p>
      <p>PS -- </p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq-4" class="faq-toggle">
    <label for="faq-4" class="faq-question">Why make this?</label>
    <div class="faq-answer">
      <p>An excellent question, and one my imaginary therapist asks frequently.</p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq-5" class="faq-toggle">
    <label for="faq-5" class="faq-question">Is this legal advice?</label>
    <div class="faq-answer">
      <p>This site offers the same legal authority as your neighbor's cousin who once read a book about law while waiting at the dentist. Which is to say: <em>none whatsoever</em>.</p>
      <p>If you require actual legal counsel, please consult a professional who charges by the hour and has the appropriate certificates displayed at slightly crooked angles on their office wall.</p>
      <p><em>However</em>, I do have a separate professional life where I put on my serious face and provide legitimate advice to those who want it. Get in touch (you know this by now) via <a href="https://milos.no/#contact">milos.no</a> or on  <a href="https://www.linkedin.com/in/milosnovovic/">LinkedIn</a>. Always happy to chat :)</p>
    </div>
  </div>
</div>

<script>
  // Initialize FAQ items as collapsed
  document.addEventListener('DOMContentLoaded', function() {
    // All FAQ toggles start unchecked (collapsed)
    const faqToggles = document.querySelectorAll('.faq-toggle');
    faqToggles.forEach(toggle => {
      toggle.checked = false;
    });
  });
</script>


---


![[Case law by date]]